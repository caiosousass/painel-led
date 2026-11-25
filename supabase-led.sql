-- Projetech · Painel de LED — banco no Supabase
-- Rode UMA vez no mesmo projeto do Projetech Calculator: SQL Editor → New query → cole tudo → Run.
-- Pode rodar de novo sem medo (idempotente). Não mexe nas tabelas do Calculator nem do Estoque.
--
-- Quem entra: só quem está em led_membros. O login é o mesmo do Projetech.
-- O administrador do Calculator (profiles.is_admin) vira o ADMINISTRADOR daqui: acesso total e
-- é quem escolhe, para cada pessoa, o que ela vê e edita (tela Equipe do app).
-- As permissões por módulo seguem js/permissoes.js — os dois precisam andar juntos.

-- ============================================================
-- 1. Equipe e permissões
-- ============================================================
create table if not exists public.led_membros (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text,
  nome        text,
  papel       text not null default 'membro',
  permissoes  jsonb not null default '{}'::jsonb,   -- { "listas": "editar", "estoque": "ver", ... }
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);
-- (quem rodou a versão anterior deste arquivo: acrescenta a coluna e aceita os papéis novos)
alter table public.led_membros add column if not exists permissoes jsonb not null default '{}'::jsonb;
alter table public.led_membros drop constraint if exists led_membros_papel_check;
update public.led_membros set papel = 'admin' where papel = 'supervisor';
update public.led_membros set papel = 'membro' where papel = 'tecnico';
alter table public.led_membros add constraint led_membros_papel_check check (papel in ('admin', 'membro'));

create or replace function public.led_membro()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.led_membros m where m.user_id = auth.uid() and m.ativo)
$$;

create or replace function public.led_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.led_membros m where m.user_id = auth.uid() and m.ativo and m.papel = 'admin')
$$;

-- Pode EDITAR o módulo? Admin pode tudo. Membro sem nada configurado = modelo "Técnico do galpão".
create or replace function public.led_pode(p_modulo text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.led_membros m
    where m.user_id = auth.uid() and m.ativo and (
      m.papel = 'admin'
      or coalesce(
           nullif(m.permissoes, '{}'::jsonb),
           '{"inicio":"ver","listas":"editar","separacao":"editar","retorno":"editar","estoque":"ver","manutencao":"editar","bancada":"editar","regras":"ver","catalogo":"ver"}'::jsonb
         ) ->> p_modulo = 'editar'
    )
  )
$$;

-- Quem grava em cada "tabela" do app (espelho de GRAVA em js/permissoes.js).
create or replace function public.led_pode_gravar(p_tabela text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case p_tabela
    when 'catalogo'    then public.led_pode('catalogo')
    when 'regras'      then public.led_pode('regras')
    when 'listas'      then public.led_pode('listas') or public.led_pode('separacao') or public.led_pode('retorno')
    when 'linhas'      then public.led_pode('listas') or public.led_pode('separacao') or public.led_pode('retorno')
    when 'manutencoes' then public.led_pode('manutencao') or public.led_pode('retorno')
    when 'manutlog'    then public.led_pode('manutencao')
    when 'producao'    then public.led_pode('bancada') or public.led_pode('manutencao')
    when 'movimentos'  then public.led_pode('estoque') or public.led_pode('retorno') or public.led_pode('manutencao')
    when 'atividade'   then public.led_membro()
    else public.led_admin()
  end
$$;

alter table public.led_membros enable row level security;
drop policy if exists led_membros_ver on public.led_membros;
create policy led_membros_ver on public.led_membros
  for select to authenticated using (user_id = auth.uid() or public.led_admin());
drop policy if exists led_membros_mudar on public.led_membros;
create policy led_membros_mudar on public.led_membros
  for update to authenticated using (public.led_admin()) with check (public.led_admin());

-- Admin libera alguém que já tem login no Projetech (Authentication → Users), já com as permissões.
drop function if exists public.led_adicionar_membro(text, text, text);
create or replace function public.led_adicionar_membro(p_email text, p_nome text, p_permissoes jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.led_admin() then raise exception 'Só o administrador adiciona pessoas.'; end if;
  select u.id into v_id from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'Esse e-mail ainda não tem conta. Peça para a pessoa abrir o link do app e tocar "Primeiro acesso? Criar minha conta" — depois ela aparece em "Pedindo acesso".';
  end if;
  insert into public.led_membros (user_id, email, nome, papel, permissoes, ativo)
  values (v_id, lower(trim(p_email)), coalesce(nullif(trim(p_nome), ''), p_email), 'membro', coalesce(p_permissoes, '{}'::jsonb), true)
  on conflict (user_id) do update set nome = excluded.nome, permissoes = excluded.permissoes, ativo = true;
end $$;
revoke all on function public.led_adicionar_membro(text, text, jsonb) from public, anon;
grant execute on function public.led_adicionar_membro(text, text, jsonb) to authenticated;

-- ============================================================
-- 2. Os dados (uma tabela só: listas, linhas, catálogo, regras, manutenção, bancada,
--    movimentos de estoque e o registro de atividade). O app é local-first e sincroniza por aqui.
-- ============================================================
create table if not exists public.led_docs (
  tabela         text not null,
  id             text not null,
  dados          jsonb not null default '{}'::jsonb,
  excluido       boolean not null default false,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid,
  primary key (tabela, id)
);
create index if not exists led_docs_atualizado_em on public.led_docs (atualizado_em);

-- Hora e autor vêm do servidor (não dá para o aparelho mentir a hora de um check).
create or replace function public.led_docs_carimbo()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := clock_timestamp();
  new.atualizado_por := auth.uid();
  return new;
end $$;
drop trigger if exists led_docs_carimbo on public.led_docs;
create trigger led_docs_carimbo before insert or update on public.led_docs
  for each row execute function public.led_docs_carimbo();

alter table public.led_docs enable row level security;

-- Ler: qualquer membro ativo (o app esconde as telas que a pessoa não pode abrir).
drop policy if exists led_docs_ler on public.led_docs;
create policy led_docs_ler on public.led_docs
  for select to authenticated using (public.led_membro());

-- Gravar: só o que o administrador liberou para a pessoa (por módulo).
drop policy if exists led_docs_criar on public.led_docs;
create policy led_docs_criar on public.led_docs
  for insert to authenticated
  with check (public.led_membro() and public.led_pode_gravar(tabela));

-- Registro de atividade não se edita (é o que o administrador usa para fiscalizar).
drop policy if exists led_docs_alterar on public.led_docs;
create policy led_docs_alterar on public.led_docs
  for update to authenticated
  using (public.led_membro() and tabela <> 'atividade' and public.led_pode_gravar(tabela))
  with check (public.led_membro() and tabela <> 'atividade' and public.led_pode_gravar(tabela));
-- Nada é apagado de verdade: exclusão vira excluido = true (os outros aparelhos ficam sabendo).

-- Tempo real: o que o técnico tica no galpão aparece na hora no celular do administrador.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'led_docs') then
    alter publication supabase_realtime add table public.led_docs;
  end if;
end $$;

-- ============================================================
-- 3. Primeiro administrador
-- ============================================================
-- (a) Projeto que já tem o Projetech Calculator: o administrador de lá vira o administrador daqui.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') then
    insert into public.led_membros (user_id, email, nome, papel)
    select p.id, p.email, coalesce(nullif(p.nome, ''), p.email), 'admin'
    from public.profiles p where p.is_admin
    on conflict (user_id) do update set papel = 'admin', ativo = true;
  end if;
end $$;

-- (b) Projeto novo: enquanto NÃO existe nenhum administrador, quem entrar primeiro no app vira o administrador.
--     Depois disso esta função não faz mais nada. (Crie o seu login em Authentication → Users e entre logo;
--     e desligue "Allow new users to sign up" para ninguém se cadastrar sozinho.)
create or replace function public.led_primeiro_admin()
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_email text;
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from public.led_membros where papel = 'admin' and ativo) then return false; end if;
  select u.email into v_email from auth.users u where u.id = auth.uid();
  insert into public.led_membros (user_id, email, nome, papel, ativo)
  values (auth.uid(), v_email, v_email, 'admin', true)
  on conflict (user_id) do update set papel = 'admin', ativo = true;
  return true;
end $$;
revoke all on function public.led_primeiro_admin() from public, anon;
grant execute on function public.led_primeiro_admin() to authenticated;

-- ============================================================
-- 4. Permissões de acesso às tabelas (projetos novos do Supabase não dão sozinhos)
-- ============================================================
-- Só quem está LOGADO chega às tabelas; o que cada um lê e grava continua decidido pelas regras (RLS) acima.
-- Ninguém apaga linha de verdade (exclusão é marcação), então não há "delete".
grant usage on schema public to authenticated;
grant select, insert, update on public.led_docs to authenticated;
grant select, update on public.led_membros to authenticated;
grant execute on function public.led_membro() to authenticated;
grant execute on function public.led_admin() to authenticated;
grant execute on function public.led_pode(text) to authenticated;
grant execute on function public.led_pode_gravar(text) to authenticated;
revoke all on public.led_docs from anon;
revoke all on public.led_membros from anon;

-- ============================================================
-- 5. Acesso pelo próprio app (sem abrir o Supabase)
-- ============================================================
-- O técnico cria a conta no link do app ("Primeiro acesso"). Quem não foi liberado não vê nada (RLS acima);
-- o administrador vê os pedidos em Equipe e libera ou recusa. Esqueceu a senha: o administrador define uma
-- provisória em Equipe, e a pessoa troca em Ajustes.
-- No Supabase, uma vez: Authentication → Sign In / Providers → Email: "Allow new users to sign up" LIGADO e
-- "Confirm email" DESLIGADO (o e-mail grátis do Supabase só entrega para quem é do time do projeto).

create or replace function public.led_pedidos_acesso()
returns table (user_id uuid, email text, nome text, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.led_admin() then raise exception 'Só o administrador vê os pedidos de acesso.'; end if;
  return query
    select u.id, u.email::text, coalesce(nullif(u.raw_user_meta_data->>'nome', ''), u.email)::text, u.created_at
    from auth.users u
    where not exists (select 1 from public.led_membros m where m.user_id = u.id)
    order by u.created_at desc;
end $$;
revoke all on function public.led_pedidos_acesso() from public, anon;
grant execute on function public.led_pedidos_acesso() to authenticated;

-- Recusar: a conta fica registrada como inativa (não volta para os pedidos; dá para reativar em Equipe)
create or replace function public.led_recusar_acesso(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.led_admin() then raise exception 'Só o administrador recusa acesso.'; end if;
  insert into public.led_membros (user_id, email, nome, papel, ativo)
  select u.id, u.email, coalesce(nullif(u.raw_user_meta_data->>'nome', ''), u.email), 'membro', false
  from auth.users u where u.id = p_user
  on conflict (user_id) do update set ativo = false;
end $$;
revoke all on function public.led_recusar_acesso(uuid) from public, anon;
grant execute on function public.led_recusar_acesso(uuid) to authenticated;

-- Senha provisória para quem esqueceu (só para gente da equipe; não mexe na senha de outro administrador)
create or replace function public.led_definir_senha(p_user uuid, p_senha text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.led_admin() then raise exception 'Só o administrador troca a senha de alguém.'; end if;
  if length(coalesce(p_senha, '')) < 6 then raise exception 'A senha precisa de pelo menos 6 caracteres.'; end if;
  if not exists (select 1 from public.led_membros m where m.user_id = p_user) then raise exception 'Essa pessoa não é da equipe do Painel de LED.'; end if;
  if p_user <> auth.uid() and exists (select 1 from public.led_membros m where m.user_id = p_user and m.papel = 'admin') then
    raise exception 'A senha de outro administrador só ele mesmo troca.';
  end if;
  update auth.users set encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf')), updated_at = now()
  where id = p_user;
end $$;
revoke all on function public.led_definir_senha(uuid, text) from public, anon;
grant execute on function public.led_definir_senha(uuid, text) to authenticated;

-- Para conferir:  select nome, email, papel, permissoes, ativo from public.led_membros;
