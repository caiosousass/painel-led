/* Projetech · Painel de LED — configuração.
 *
 * Com os dois campos vazios o sistema roda em MODO LOCAL: tudo fica só neste aparelho
 * (bom para experimentar). Para a equipe inteira usar junto — e o supervisor acompanhar de
 * qualquer lugar — rode `supabase-led.sql` no Supabase e preencha os dois campos abaixo
 * (Supabase → Project Settings → API). É o mesmo projeto do Projetech Calculator.
 *
 * A chave aqui é a "anon / publishable" — pública por natureza. Quem protege os dados são as
 * regras RLS do SQL (só membros do setor leem e gravam). NUNCA coloque a chave service_role.
 */
export const CONFIG = {
  supabaseUrl: 'https://vusrfzznjubpszxccgll.supabase.co',
  supabaseKey: 'sb_publishable_gMTXbzZiRZBY-_wdclFhMw_gYRHHXs6'
};
