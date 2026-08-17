-- Shared-layer seed: the Summer 2027 PM-intern season.
--
-- GENERATED from lib/hq/seed.ts by scripts/generate-seed-sql.mjs — edit the
-- TS file and regenerate rather than editing here. Idempotent: reruns are
-- no-ops thanks to the unique keys on companies.slug and
-- postings (company_id, season, program).

insert into companies (slug, name, careers_url, tier_default)
values ('microsoft', 'Microsoft', 'https://careers.microsoft.com', 1)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://careers.microsoft.com/v2/global/en/universityinternship', 'Microsoft Careers', 'summer-2027', 'closed',
       'Opened and closed early August', 'Short early-August window. Next cycle is a year out.', false, null, 'seed'
from companies c where c.slug = 'microsoft'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('capitalone', 'Capital One', 'https://www.capitalonecareers.com', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'Product Development Intern, Summer 2027', 'https://www.capitalonecareers.com/students', 'Capital One Careers', 'summer-2027', 'closed',
       'Opened mid July, now closed', '', false, null, 'seed'
from companies c where c.slug = 'capitalone'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('appian', 'Appian', 'https://careers.appian.com', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://careers.appian.com/jobs/8041243-product-manager-intern-', 'Greenhouse', 'summer-2027', 'open',
       'Open since early August', '', false, null, 'seed'
from companies c where c.slug = 'appian'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('amex', 'Amex Digital Labs', 'https://www.americanexpress.com/en-us/careers/', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'Digital Product Analyst Intern, Summer 2027', 'https://www.americanexpress.com/en-us/careers/students/', 'Amex Careers', 'summer-2027', 'open',
       'Open since early August', '', false, null, 'seed'
from companies c where c.slug = 'amex'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('vertiv', 'Vertiv', 'https://careers.vertiv.com', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://careers.vertiv.com', 'Vertiv Careers', 'summer-2027', 'open',
       'Open since August', '', false, null, 'seed'
from companies c where c.slug = 'vertiv'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('salesforce', 'Salesforce', 'https://www.salesforce.com/company/careers/', 1)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'APM Intern, Summer 2027 (Futureforce)', 'https://www.salesforce.com/company/careers/jobs/JR348039/', 'Workday', 'summer-2027', 'open',
       'Open since mid July, rolling', '', false, null, 'seed'
from companies c where c.slug = 'salesforce'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('databricks', 'Databricks', 'https://www.databricks.com/company/careers', 1)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'Product Management Intern, Summer 2027', 'https://www.databricks.com/company/careers/product/product-management-intern-summer-2027-6883068002', 'Greenhouse', 'summer-2027', 'open',
       'Open now, rolling', 'Rolling review. Every day of delay costs odds.', false, 'now', 'seed'
from companies c where c.slug = 'databricks'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('duolingo', 'Duolingo', 'https://careers.duolingo.com', 1)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'APM Intern, Summer 2027', 'https://careers.duolingo.com', '', 'summer-2027', 'watching',
       'Expected late September to mid October, hard deadline', 'Hard cutoff. Miss it, wait a year.', true, 'sep', 'seed'
from companies c where c.slug = 'duolingo'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('meta', 'Meta', 'https://www.metacareers.com', 1)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'RPM Intern, Summer 2027', 'https://www.metacareers.com/rpm', '', 'summer-2027', 'watching',
       'Expected late August per last cycle, unverified', 'Could open any day.', true, 'aug', 'seed'
from companies c where c.slug = 'meta'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('amazon', 'Amazon', 'https://www.amazon.jobs', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027 (multiple orgs)', 'https://www.amazon.jobs/en/teams/internships-for-students', '', 'summer-2027', 'watching',
       'Expected August to September, rolling', '', false, 'aug', 'seed'
from companies c where c.slug = 'amazon'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('google', 'Google', 'https://www.google.com/about/careers/', 1)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'APM Intern, Summer 2027', 'https://www.google.com/about/careers/applications/students', '', 'summer-2027', 'watching',
       'Expected October, 2 to 4 week window', 'Very short window. Recruits non-CS majors.', true, 'oct', 'seed'
from companies c where c.slug = 'google'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('linkedin', 'LinkedIn', 'https://careers.linkedin.com', 1)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'APM Intern, Summer 2027', 'https://careers.linkedin.com/students', '', 'summer-2027', 'watching',
       'Expected early October, about 11 days', 'Very short window.', true, 'oct', 'seed'
from companies c where c.slug = 'linkedin'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('atlassian', 'Atlassian', 'https://www.atlassian.com/company/careers', 1)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'APM Intern, Summer 2027', 'https://www.atlassian.com/company/careers/students', '', 'summer-2027', 'watching',
       'Expected fall, about a 4 day window', 'Extremely short window. Speed is everything.', true, 'oct', 'seed'
from companies c where c.slug = 'atlassian'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('uber', 'Uber', 'https://www.uber.com/us/en/careers/', 1)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://www.uber.com/us/en/careers/teams/university/', '', 'summer-2027', 'watching',
       'Expected August to October', '', false, 'sep', 'seed'
from companies c where c.slug = 'uber'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('intuit', 'Intuit', 'https://www.intuit.com/careers/', 1)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'RPM Intern, Summer 2027', 'https://www.intuit.com/careers/students/', '', 'summer-2027', 'watching',
       'Expected September', '', false, 'sep', 'seed'
from companies c where c.slug = 'intuit'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('servicenow', 'ServiceNow', 'https://careers.servicenow.com', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'APM Intern, Summer 2027', 'https://careers.servicenow.com/careers/students/', '', 'summer-2027', 'watching',
       'Expected September to October', '', false, 'sep', 'seed'
from companies c where c.slug = 'servicenow'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('stripe', 'Stripe', 'https://stripe.com/jobs', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://stripe.com/jobs/university', '', 'summer-2027', 'watching',
       'Expected August to October', '', false, 'sep', 'seed'
from companies c where c.slug = 'stripe'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('palantir', 'Palantir', 'https://www.palantir.com/careers/', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027 (PD)', 'https://www.palantir.com/careers/', '', 'summer-2027', 'watching',
       'Expected August to October, fills before November', '', false, 'sep', 'seed'
from companies c where c.slug = 'palantir'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('tiktok', 'TikTok', 'https://lifeattiktok.com', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://lifeattiktok.com/campus', '', 'summer-2027', 'watching',
       'Expected August to October', '', false, 'sep', 'seed'
from companies c where c.slug = 'tiktok'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('block', 'Block (Square)', 'https://block.xyz/careers', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://block.xyz/careers', '', 'summer-2027', 'watching',
       'Expected August to October', '', false, 'sep', 'seed'
from companies c where c.slug = 'block'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('bloomberg', 'Bloomberg', 'https://www.bloomberg.com/careers/', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://www.bloomberg.com/careers/early-career/', '', 'summer-2027', 'watching',
       'Expected August to October', '', false, 'sep', 'seed'
from companies c where c.slug = 'bloomberg'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('adobe', 'Adobe', 'https://www.adobe.com/careers.html', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://www.adobe.com/careers/university.html', '', 'summer-2027', 'watching',
       'Expected after Labor Day', '', false, 'sep', 'seed'
from companies c where c.slug = 'adobe'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('apple', 'Apple', 'https://www.apple.com/careers/us/', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://www.apple.com/careers/us/students.html', '', 'summer-2027', 'watching',
       'Expected September to November', '', false, 'sep', 'seed'
from companies c where c.slug = 'apple'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('spotify', 'Spotify', 'https://www.lifeatspotify.com', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://www.lifeatspotify.com/students', '', 'summer-2027', 'watching',
       'Expected September to October', '', false, 'sep', 'seed'
from companies c where c.slug = 'spotify'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('hubspot', 'HubSpot', 'https://www.hubspot.com/careers', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://www.hubspot.com/careers/students', '', 'summer-2027', 'watching',
       'Expected September to November', '', false, 'sep', 'seed'
from companies c where c.slug = 'hubspot'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('cloudflare', 'Cloudflare', 'https://www.cloudflare.com/careers/', 2)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM Intern, Summer 2027', 'https://www.cloudflare.com/careers/early-talent/', '', 'summer-2027', 'watching',
       'Expected December to January', 'Late window. Good backstop.', false, 'dec', 'seed'
from companies c where c.slug = 'cloudflare'
on conflict (company_id, season, program) do nothing;

insert into companies (slug, name, careers_url, tier_default)
values ('ycombinator', 'YC startups', 'https://www.workatastartup.com', 3)
on conflict (slug) do nothing;

insert into postings (company_id, program, url, portal, season, status,
                      window_expected, window_note, short_window, radar, source)
select c.id, 'PM roles via Work at a Startup', 'https://www.workatastartup.com', '', 'summer-2027', 'watching',
       'Rolling, year round', 'Sweep monthly for PM intern posts.', false, 'now', 'seed'
from companies c where c.slug = 'ycombinator'
on conflict (company_id, season, program) do nothing;
