insert into public.taxback_claim_catalog (region, category, eligibility_rules, estimate_formula, official_link)
select 'UK', 'Work Uniform Maintenance',
       'Employee washes or repairs mandatory work uniform.',
       'Flat-rate tax relief depends on occupation category.',
       'https://www.gov.uk/tax-relief-for-employees'
where not exists (
  select 1 from public.taxback_claim_catalog where region = 'UK' and category = 'Work Uniform Maintenance'
);

insert into public.taxback_claim_catalog (region, category, eligibility_rules, estimate_formula, official_link)
select 'IE', 'Remote Working Relief',
       'Employee works remotely and pays eligible utility costs.',
       'Relief based on allowable utility apportionment at marginal tax rate.',
       'https://www.revenue.ie/en/jobs-and-pensions/eworking/index.aspx'
where not exists (
  select 1 from public.taxback_claim_catalog where region = 'IE' and category = 'Remote Working Relief'
);
