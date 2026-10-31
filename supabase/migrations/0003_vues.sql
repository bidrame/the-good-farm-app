-- Solde par client : restes à payer sur les ventes moins les paiements. Positif = le client doit.
create view public.v_soldes_clients with (security_invoker = true) as
select c.id as client_id,
       coalesce(v.du, 0) - coalesce(p.paye, 0) as solde
from public.clients c
left join (
  select client_id, sum(montant - montant_paye)::bigint as du
  from public.transactions
  where type = 'vente' and supprime_le is null
  group by client_id
) v on v.client_id = c.id
left join (
  select client_id, sum(montant)::bigint as paye
  from public.paiements
  where supprime_le is null
  group by client_id
) p on p.client_id = c.id
where c.supprime_le is null;
