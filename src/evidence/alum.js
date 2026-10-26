// Maya Chen after NIST (Class of 2027, seen in March 2029): the evidence behind each later station.
export default {
  'al-01': {
    'EE grade: A': { t: 'result', system: 'ManageBac', course: 'IB Extended Essay · Biology', task: 'To what extent can rainfall and temperature predict weekly dengue cases in Bangkok?', colA: 'Criterion',
      rows: [['A: Focus and method', 6, 6], ['B: Knowledge and understanding', 5, 6], ['C: Critical thinking', 11, 12], ['D: Presentation', 4, 4], ['E: Engagement', 5, 6]], grade: 'A', gradeLabel: 'Grade', scale: 'IB A–E · 31 of 34',
      comment: 'An unusually honest essay. Maya tests her own six-week lag against the data rather than assuming it, and the discussion of what weather cannot explain (school terms, mosquito control campaigns) is the strongest part. The viva showed she understands every line of her model.', by: 'Mr David Okafor, EE supervisor' },
  },
  'al-02': {
    'Signed graduation record': { t: 'doc', heading: 'Graduation record', sub: 'NIST International School · Class of 2027', pages: 3, meta: 'Student: Maya Chen · Graduated: 12 June 2027 · Record ID: TP-ST01-2027 · Signed: NIST registrar key, 12 June 2027', blocks: [
      'This record lists every station on Maya Chen’s Transit Portfolio at graduation. Items marked school-verified were imported from school systems; items marked teacher-endorsed were reviewed by the named teacher. Each carries a verification code that can be checked at any time on the school’s verification page.',
      ['stats', [['Stations', '41'], ['Lines', '6'], ['School-verified', '19'], ['Teacher-endorsed', '12'], ['Reflections', '40']]],
      ['h', 'Lines at graduation'],
      ['table', ['Line', 'Stations', 'Verified'], [['Science', '11', '9'], ['Computing', '10', '7'], ['Environment', '7', '5'], ['Service', '7', '4'], ['Data Science', '6', '4'], ['Swimming', '5', '3']]],
      ['note', 'Registrar', 'The signatures on verified items are kept by the school after graduation, so their codes keep working. The student owns this copy and may share it freely.'],
      ['sign', 'Ms Siriporn Kaewmanee', 'Registrar, NIST International School'] ] },
  },
  'al-03': {
    'IB Diploma results': { t: 'cert', org: 'International Baccalaureate', kind: 'Diploma Programme results', pre: 'This is to certify that', name: 'Maya Chen', line: 'has been awarded the IB Diploma, May 2027 session', award: '41 points', sign: 'Issued via NIST exams office, 6 July 2027', seal: 'IB', colour: '#002855', no: 'Candidate session 003117-0042' },
  },
  'al-04': {
    'Enrolment confirmation': { t: 'doc', heading: 'Confirmation of enrolment', sub: 'Northbridge University (fictional) · Faculty of Science', pages: 1, org: 'Northbridge University (fictional)', meta: 'Student: Maya Chen · Student number: NB2731184 · Programme: BSc Data Science (Environmental Modelling pathway) · Start: 20 September 2027 · Mode: Full time, 3 years, optional placement year', blocks: [
      'We confirm that Maya Chen is enrolled on the programme above for the academic year 2027–28.',
      ['h', 'Year 1 modules'],
      ['list', ['Programming for Data Science (Python)', 'Probability and Statistics I', 'Linear Algebra', 'Data Wrangling and Visualisation', 'Environmental Systems', 'Group Project: Forecasting']],
      ['sign', 'Student Records Office', 'Northbridge University (fictional)'] ] },
  },
  'al-05': {
    'Project repository': { t: 'repo', repo: 'nb-ds-y1/river-forecast', about: 'Forecast river level at the city gauge 24 h ahead from five upstream rain and level gauges.', lang: [['Jupyter Notebook', 64], ['Python', 33], ['Shell', 3]], files: ['data/', 'notebooks/', 'notebooks/01_eda.ipynb', 'notebooks/02_baselines.ipynb', 'notebooks/03_gbm.ipynb', 'forecast/', 'forecast/features.py', 'forecast/model.py', 'report.pdf', 'README.md'], commitCount: 88,
      commits: [['Final report and slides', 'Dec 7, 2027'], ['Quantile model for 90% intervals', 'Dec 2, 2027'], ['Lagged upstream features (Maya)', 'Nov 24, 2027'], ['Persistence and linear baselines', 'Nov 10, 2027']],
      readme: [['h', 'river-forecast'], 'Year 1 group project, team of four. We predict the river level 24 hours ahead using the last 72 hours of five upstream gauges.', ['table', ['Model', 'MAE (cm)', 'Within 10 cm'], [['Persistence (same as now)', '18.4', '41%'], ['Linear on lags', '11.2', '58%'], ['Gradient boosting', '7.9', '73%']]], ['h', 'My part'], 'I built the lagged features and the travel-time analysis: rain at the furthest gauge takes about 19 hours to show at the city.', ['code', '$ pip install -e .\n$ python -m forecast.model --train 2015-2024 --test 2025']] },
    'Module mark: 78%': { t: 'result', system: 'Northbridge student record', org: 'Northbridge University (fictional)', course: 'DS1060 Group Project: Forecasting', task: 'Team project, report and presentation', colA: 'Component',
      rows: [['Technical work', 32, 40], ['Report', 23, 30], ['Presentation', 15, 20], ['Peer assessment', 8, 10]], grade: '78%', gradeLabel: 'Mark', scale: 'First-class band is 70% and above',
      comment: 'The upstream travel-time analysis was the insight that made the model work, and it was explained clearly in the presentation. The report would be stronger with an honest section on where the model fails (the 2025 flash flood).', by: 'Dr H. Adebayo, module leader' },
  },
  'al-06': {
    'Society project page': { t: 'web', url: 'example.org/dfg', site: 'Data for Good · Northbridge', blocks: [
      ['h', 'Food bank donations, cleaned'], 'The city food bank had six years of donation records across three spreadsheets and a paper ledger. Four of us cleaned and joined them so the bank can see which months run short.',
      ['bars', 'Average shortfall by month (food parcels)', [['Jan', 140], ['Feb', 95], ['Mar', 60], ['Jul', 120], ['Aug', 155], ['Dec', 30]], 'parcels'],
      ['quote', 'We had always guessed August was bad. Now we can show a funder exactly how bad. (Food bank coordinator)'],
      ['note', 'Team', 'Maya Chen, Jonah Reyes, Aisha Bello, Tom Lindqvist'] ] },
  },
  'al-07': {
    'Internship reference': { t: 'doc', heading: 'Internship reference', sub: 'City Council (fictional) · Environmental Health, Air Quality team', pages: 1, org: 'City Council (fictional) · Environmental Health', meta: 'Intern: Maya Chen · Dates: 24 June to 30 August 2028 · Supervisor: Dr Rosa Lindgren, Senior Air Quality Officer', blocks: [
      'Maya joined us for ten weeks to help with our low-cost sensor network. She recalibrated 40 street sensors against our two reference stations and wrote up the method so we can repeat it each year.',
      'She then built the dashboard we now use for our weekly report to councillors. It replaced a spreadsheet that took a day each week to update.',
      'What stood out was her care with uncertainty. Every chart she made says how sure we can be, and she was the first intern to ask what the councillors actually decide with the numbers.',
      'I would gladly have her back, and I recommend her without reservation.',
      ['sign', 'Dr Rosa Lindgren', 'Senior Air Quality Officer'] ] },
    'Dashboard (public version)': { t: 'web', url: 'example.org/city-aq', site: 'City air quality · this week', blocks: [
      ['stats', [['Sensors live', '40 of 40'], ['City mean PM2.5', '11.4 µg/m³'], ['Hours above WHO daily guide', '6'], ['Calibrated', 'Jul 2028']]],
      ['bars', 'PM2.5 by district, weekly mean', [['Centre', 14.2], ['Harbour', 12.8], ['North', 9.6], ['University', 8.1], ['West', 10.9]], 'µg/m³'],
      'Readings come from low-cost sensors corrected against two reference stations. Each value shows its 90% range on hover.',
      ['note', 'Built by', 'Maya Chen, summer intern 2028'] ] },
  },
  'al-09': {
    'Project report': { t: 'doc', heading: 'Early warning of dengue peaks in Bangkok', sub: 'DS2090 Second-year project · Maya Chen', pages: 14, org: 'Northbridge University (fictional)', meta: 'DS2090 · submitted 10 February 2029', blocks: [
      ['h', 'Abstract'], 'This project revisits my school Extended Essay with fifteen years of weekly case data. A seasonal model with lagged rainfall, temperature and humidity predicts whether a week will be in the top quarter for cases six weeks ahead, with 81% accuracy on 2023–2025.',
      ['h', 'What changed since the essay'],
      ['list', ['Fifteen years of data instead of five, so the model sees several El Niño years.', 'A proper time-series split instead of random test weeks, which my essay got wrong.', 'Humidity added: it explains more than temperature once rainfall is in.']],
      ['table', ['Lead time', 'Accuracy', 'Peaks caught'], [['2 weeks', '88%', '91%'], ['4 weeks', '84%', '85%'], ['6 weeks', '81%', '78%'], ['8 weeks', '72%', '61%']]],
      ['h', 'Limits'], 'The model cannot see vector control campaigns or school holidays, which both shift cases. Six weeks is long enough for a city to plan a campaign, which is why the report stops there.' ] },
    'Notebook': { t: 'repo', repo: 'mayachen/dengue-ews', about: 'Six-week early warning for dengue peaks in Bangkok (second-year project).', lang: [['Jupyter Notebook', 81], ['Python', 19]], files: ['data/', '01_data.ipynb', '02_essay_rerun.ipynb', '03_model.ipynb', '04_lead_times.ipynb', 'ews.py', 'README.md'], commitCount: 57,
      commits: [['Lead-time table for the report', 'Feb 8, 2029'], ['Time-series CV, drop random split', 'Jan 30, 2029'], ['Rerun the 2027 essay model on new data', 'Jan 18, 2029'], ['Load 2010–2025 weekly cases', 'Jan 12, 2029']],
      readme: [['h', 'dengue-ews'], '`02_essay_rerun.ipynb` runs the model from my 2027 Extended Essay on the new data, so you can see exactly where it held up and where it did not.', ['code', '$ python ews.py --lead 6 --plot']] },
  },
};
