const { createClient } = require('@supabase/supabase-js');

// --- CONFIG ---
const SUPABASE_URL = 'https://ihcmbujuniueazzrehbp.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloY21idWp1bml1ZWF6enJlaGJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NjQzNDYsImV4cCI6MjA4MDI0MDM0Nn0.PuostVRj4zDZS5Ro5T80eoEnkgvDsSzenzC9diD6Hx0'; 
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- THE GOLDEN LIST (Manually Curated & Accurate) ---
const GOLDEN_BUILDINGS = [
    // ================= LONDON & SE =================

    // --- IMPERIAL COLLEGE ---
    { university_id: 'imperial', building_id: 'imperial_skempton', name: 'Skempton Building', lat: 51.49835, long: -0.17589, subjects: 'Civil Engineering; Environmental Engineering' },
    { university_id: 'imperial', building_id: 'imperial_city_guilds', name: 'City and Guilds Building', lat: 51.49887, long: -0.17483, subjects: 'Mechanical Engineering; Aeronautics' },
    { university_id: 'imperial', building_id: 'imperial_chemistry', name: 'Chemistry Building', lat: 51.49772, long: -0.17726, subjects: 'Chemistry; Science' },
    { university_id: 'imperial', building_id: 'imperial_blackett', name: 'Blackett Laboratory', lat: 51.49940, long: -0.17920, subjects: 'Physics; Science' },
    { university_id: 'imperial', building_id: 'imperial_fleming', name: 'Sir Alexander Fleming Building', lat: 51.49770, long: -0.17670, subjects: 'Medicine; Biomedical Sciences' },
    { university_id: 'imperial', building_id: 'imperial_business', name: 'Imperial College Business School', lat: 51.49920, long: -0.17390, subjects: 'Business; Finance' },

    // --- UCL ---
    { university_id: 'ucl', building_id: 'ucl_ingold', name: 'Christopher Ingold Building', lat: 51.52520, long: -0.13250, subjects: 'Chemistry; Science' },
    { university_id: 'ucl', building_id: 'ucl_laws', name: 'Bentham House', lat: 51.52580, long: -0.13100, subjects: 'Law' },
    { university_id: 'ucl', building_id: 'ucl_engineering', name: 'Roberts Building', lat: 51.52340, long: -0.13200, subjects: 'Engineering' },
    { university_id: 'ucl', building_id: 'ucl_main', name: 'Wilkins Building (Main)', lat: 51.52460, long: -0.13400, subjects: 'History; Humanities; Arts' },
    { university_id: 'ucl', building_id: 'ucl_ioe', name: 'Institute of Education', lat: 51.52220, long: -0.12920, subjects: 'Education; Social Sciences' },

    // --- KING'S COLLEGE LONDON ---
    { university_id: 'kcl', building_id: 'kcl_bush_house', name: 'Bush House', lat: 51.51260, long: -0.11760, subjects: 'Business; Economics; Social Sciences' },
    { university_id: 'kcl', building_id: 'kcl_strand', name: 'King\'s Building (Strand)', lat: 51.51160, long: -0.11620, subjects: 'Physics; Mathematics; Law; Arts' },
    { university_id: 'kcl', building_id: 'kcl_guys', name: 'New Hunt\'s House', lat: 51.50370, long: -0.08870, subjects: 'Medicine; Biomedical Science' },
    { university_id: 'kcl', building_id: 'kcl_waterloo', name: 'Franklin-Wilkins Building', lat: 51.50650, long: -0.11050, subjects: 'Pharmacy; Nutrition; Forensics' },

    // --- LSE ---
    { university_id: 'lse', building_id: 'lse_old_building', name: 'Old Building', lat: 51.51440, long: -0.11650, subjects: 'Economics; Politics; Law' },
    { university_id: 'lse', building_id: 'lse_centre', name: 'Centre Building', lat: 51.51400, long: -0.11700, subjects: 'Social Sciences; Government' },
    { university_id: 'lse', building_id: 'lse_library', name: 'LSE Library', lat: 51.51460, long: -0.11580, subjects: 'Research; Library' },

    // --- ROYAL HOLLOWAY ---
    { university_id: 'royal_holloway', building_id: 'rhul_founders', name: 'Founder\'s Building', lat: 51.42570, long: -0.56300, subjects: 'Arts; Humanities; Law' },
    { university_id: 'royal_holloway', building_id: 'rhul_science', name: 'Bourne Laboratory', lat: 51.42450, long: -0.56550, subjects: 'Biology; Science' },
    { university_id: 'royal_holloway', building_id: 'rhul_business', name: 'School of Management', lat: 51.42650, long: -0.56150, subjects: 'Business; Management' },

    // --- UNIVERSITY OF SURREY ---
    { university_id: 'surrey', building_id: 'surrey_main', name: 'Senate House (Main Campus)', lat: 51.24350, long: -0.58950, subjects: 'Business; Arts; Social Sciences' },
    { university_id: 'surrey', building_id: 'surrey_engineering', name: 'Engineering and Physical Sciences', lat: 51.24420, long: -0.59100, subjects: 'Engineering; Physics' },
    { university_id: 'surrey', building_id: 'surrey_health', name: 'Kate Granger Building', lat: 51.24150, long: -0.59500, subjects: 'Health; Nursing; Medicine' },

    // --- SOUTHAMPTON ---
    { university_id: 'southampton', building_id: 'soton_highfield', name: 'Highfield Campus (Main)', lat: 50.93530, long: -1.39700, subjects: 'Engineering; Science; Social Sciences' },
    { university_id: 'southampton', building_id: 'soton_avenue', name: 'Avenue Campus', lat: 50.93150, long: -1.40500, subjects: 'Humanities; Arts; Languages' },
    { university_id: 'southampton', building_id: 'soton_noc', name: 'National Oceanography Centre', lat: 50.89300, long: -1.39300, subjects: 'Oceanography; Earth Science' },

    // --- PORTSMOUTH ---
    { university_id: 'portsmouth', building_id: 'port_park', name: 'Park Building', lat: 50.79630, long: -1.09650, subjects: 'Law; Business; Humanities' },
    { university_id: 'portsmouth', building_id: 'port_anglesea', name: 'Anglesea Building', lat: 50.79850, long: -1.09800, subjects: 'Engineering; Technology' },
    { university_id: 'portsmouth', building_id: 'port_eldon', name: 'Eldon Building', lat: 50.79500, long: -1.10000, subjects: 'Arts; Creative Technologies' },

    // --- SUSSEX (Brighton) ---
    { university_id: 'sussex', building_id: 'sussex_falmer', name: 'Falmer House', lat: 50.86710, long: -0.08790, subjects: 'Social Sciences; Arts' },
    { university_id: 'sussex', building_id: 'sussex_science', name: 'Pevensey Buildings', lat: 50.86850, long: -0.08650, subjects: 'Physics; Mathematics; Science' },
    { university_id: 'sussex', building_id: 'sussex_library', name: 'The Library', lat: 50.86650, long: -0.08850, subjects: 'Research; Study' },

    // --- KENT (Canterbury) ---
    { university_id: 'kent', building_id: 'kent_templeman', name: 'Templeman Library', lat: 51.29740, long: 1.06970, subjects: 'Library; Study Hub' },
    { university_id: 'kent', building_id: 'kent_marlowe', name: 'Marlowe Building', lat: 51.29650, long: 1.06600, subjects: 'Architecture; Arts' },
    { university_id: 'kent', building_id: 'kent_sibson', name: 'Sibson Building', lat: 51.29850, long: 1.06500, subjects: 'Business; Mathematics' },

    // --- READING ---
    { university_id: 'reading', building_id: 'reading_library', name: 'University Library', lat: 51.44180, long: -0.94130, subjects: 'Library; Study' },
    { university_id: 'reading', building_id: 'reading_henley', name: 'Henley Business School', lat: 51.44050, long: -0.94400, subjects: 'Business; Finance' },
    { university_id: 'reading', building_id: 'reading_science', name: 'Life Sciences Building', lat: 51.44250, long: -0.93900, subjects: 'Biology; Chemistry' },

    // --- WINCHESTER ---
    { university_id: 'winchester', building_id: 'winch_main', name: 'King Alfred Quarter', lat: 51.06070, long: -1.32630, subjects: 'Arts; Humanities; Social Sciences' },
    { university_id: 'winchester', building_id: 'winch_west', name: 'West Downs Quarter', lat: 51.06200, long: -1.33200, subjects: 'Business; Media' },

    // --- OXFORD ---
    { university_id: 'oxford', building_id: 'oxford_science_area', name: 'Science Area (South Parks)', lat: 51.75800, long: -1.25600, subjects: 'Chemistry; Physics; Biology' },
    { university_id: 'oxford', building_id: 'oxford_radcliffe', name: 'Radcliffe Camera', lat: 51.75340, long: -1.25400, subjects: 'History; Arts; Library' },
    { university_id: 'oxford', building_id: 'oxford_med', name: 'Medical Sciences Division', lat: 51.76000, long: -1.21800, subjects: 'Medicine' },
    { university_id: 'oxford', building_id: 'oxford_sbs', name: 'Saïd Business School', lat: 51.75300, long: -1.26800, subjects: 'Business; Management' },


    // ================= SOUTH WEST =================

    // --- BRISTOL ---
    { university_id: 'bristol', building_id: 'bristol_wills', name: 'Wills Memorial Building', lat: 51.45660, long: -2.60420, subjects: 'Law; Earth Sciences' },
    { university_id: 'bristol', building_id: 'bristol_chemistry', name: 'School of Chemistry', lat: 51.45820, long: -2.60250, subjects: 'Chemistry; Science' },
    { university_id: 'bristol', building_id: 'bristol_life', name: 'Life Sciences Building', lat: 51.45920, long: -2.60100, subjects: 'Biology; Life Sciences' },
    { university_id: 'bristol', building_id: 'bristol_eng', name: 'Queen\'s Building', lat: 51.45780, long: -2.60350, subjects: 'Engineering' },

    // --- BATH ---
    { university_id: 'bath', building_id: 'bath_library', name: 'The Library', lat: 51.37830, long: -2.32620, subjects: 'Library; Central Campus' },
    { university_id: 'bath', building_id: 'bath_chancellors', name: 'Chancellors\' Building', lat: 51.37900, long: -2.32500, subjects: 'Business; Management' },
    { university_id: 'bath', building_id: 'bath_engineering', name: 'East Building', lat: 51.37950, long: -2.32300, subjects: 'Engineering; Architecture' },

    // --- EXETER ---
    { university_id: 'exeter', building_id: 'exeter_forum', name: 'The Forum', lat: 50.73710, long: -3.53510, subjects: 'Central Hub; Library' },
    { university_id: 'exeter', building_id: 'exeter_business', name: 'Business School', lat: 50.73800, long: -3.53200, subjects: 'Business; Economics' },
    { university_id: 'exeter', building_id: 'exeter_physics', name: 'Physics Building', lat: 50.73600, long: -3.53600, subjects: 'Physics; Engineering' },

    // --- FALMOUTH ---
    { university_id: 'falmouth', building_id: 'fal_penryn', name: 'Penryn Campus (Main)', lat: 50.16900, long: -5.12300, subjects: 'Arts; Design; Media' },
    { university_id: 'falmouth', building_id: 'fal_woodlane', name: 'Falmouth Campus (Woodlane)', lat: 50.15100, long: -5.07200, subjects: 'Fine Art; Graphics' },

    // --- PLYMOUTH ---
    { university_id: 'plymouth', building_id: 'plym_roland', name: 'Roland Levinsky Building', lat: 50.37440, long: -4.13960, subjects: 'Arts; Architecture; Design' },
    { university_id: 'plymouth', building_id: 'plym_science', name: 'Davey Building', lat: 50.37500, long: -4.13800, subjects: 'Chemistry; Science' },
    { university_id: 'plymouth', building_id: 'plym_marine', name: 'Marine Building', lat: 50.37300, long: -4.14100, subjects: 'Marine Engineering; Civil Engineering' },

    // --- GLOUCESTERSHIRE ---
    { university_id: 'gloucestershire', building_id: 'glos_fch', name: 'Francis Close Hall (Cheltenham)', lat: 51.90600, long: -2.08300, subjects: 'Humanities; Education; Arts' },
    { university_id: 'gloucestershire', building_id: 'glos_oxstalls', name: 'Oxstalls Campus (Gloucester)', lat: 51.87000, long: -2.23000, subjects: 'Business; Computing; Sport' },

    // --- BOURNEMOUTH ---
    { university_id: 'bournemouth', building_id: 'bmth_talbot', name: 'Talbot Campus', lat: 50.74300, long: -1.89700, subjects: 'Media; Design; Tech' },
    { university_id: 'bournemouth', building_id: 'bmth_lansdowne', name: 'Lansdowne Campus', lat: 50.72200, long: -1.86500, subjects: 'Health; Business' },


    // ================= MIDLANDS =================

    // --- BIRMINGHAM ---
    { university_id: 'birmingham', building_id: 'bham_aston_webb', name: 'Aston Webb Building', lat: 52.45080, long: -1.93050, subjects: 'Law; Arts; Humanities' },
    { university_id: 'birmingham', building_id: 'bham_med', name: 'Medical School', lat: 52.45400, long: -1.93800, subjects: 'Medicine; Health' },
    { university_id: 'birmingham', building_id: 'bham_engineering', name: 'School of Engineering', lat: 52.45150, long: -1.93300, subjects: 'Engineering' },
    { university_id: 'birmingham', building_id: 'bham_business', name: 'Business School', lat: 52.45200, long: -1.92800, subjects: 'Business; Economics' },

    // --- WARWICK ---
    { university_id: 'warwick', building_id: 'warwick_wbs', name: 'Warwick Business School', lat: 52.38400, long: -1.56000, subjects: 'Business; Finance' },
    { university_id: 'warwick', building_id: 'warwick_wm', name: 'WMG (Manufacturing)', lat: 52.37800, long: -1.56500, subjects: 'Engineering; Manufacturing' },
    { university_id: 'warwick', building_id: 'warwick_arts', name: 'Warwick Arts Centre', lat: 52.38100, long: -1.56100, subjects: 'Arts; Humanities' },

    // --- NOTTINGHAM ---
    { university_id: 'nottingham', building_id: 'nott_trent', name: 'Trent Building', lat: 52.93600, long: -1.19600, subjects: 'Law; Humanities' },
    { university_id: 'nottingham', building_id: 'nott_science', name: 'Coates Building', lat: 52.93800, long: -1.19200, subjects: 'Engineering; Science' },
    { university_id: 'nottingham', building_id: 'nott_med', name: 'Queen\'s Medical Centre', lat: 52.94300, long: -1.18500, subjects: 'Medicine' },
    { university_id: 'nottingham', building_id: 'nott_jubilee', name: 'Jubilee Campus', lat: 52.95200, long: -1.18700, subjects: 'Business; Computer Science' },

    // --- LEICESTER ---
    { university_id: 'leicester', building_id: 'leic_fielding', name: 'Fielding Johnson Building', lat: 52.62090, long: -1.12460, subjects: 'Law; Admin' },
    { university_id: 'leicester', building_id: 'leic_med', name: 'George Davies Centre', lat: 52.61900, long: -1.12700, subjects: 'Medicine; Health' },
    { university_id: 'leicester', building_id: 'leic_eng', name: 'Engineering Building', lat: 52.62200, long: -1.12300, subjects: 'Engineering' },

    // --- LINCOLN ---
    { university_id: 'lincoln', building_id: 'linc_main', name: 'Brayford Pool Campus', lat: 53.22850, long: -0.54780, subjects: 'Main Campus; Arts; Science' },
    { university_id: 'lincoln', building_id: 'linc_business', name: 'David Chiddick Building', lat: 53.22700, long: -0.54500, subjects: 'Business; Law' },

    // --- DERBY ---
    { university_id: 'derby', building_id: 'derby_kedleston', name: 'Kedleston Road', lat: 52.93770, long: -1.49670, subjects: 'Main Campus; Business; Science' },
    { university_id: 'derby', building_id: 'derby_markeaton', name: 'Markeaton Street', lat: 52.93300, long: -1.49100, subjects: 'Arts; Design' },

    // --- STAFFORDSHIRE (Stoke) ---
    { university_id: 'staffordshire', building_id: 'staffs_science', name: 'Science Centre', lat: 53.00900, long: -2.17500, subjects: 'Science; Computing' },
    { university_id: 'staffordshire', building_id: 'staffs_cadman', name: 'Cadman Building', lat: 53.01000, long: -2.17600, subjects: 'Arts; Media; Law' },


    // ================= NORTH =================

    // --- MANCHESTER ---
    { university_id: 'manchester', building_id: 'man_chemistry', name: 'Chemistry Building', lat: 53.46780, long: -2.23380, subjects: 'Chemistry; Science' },
    { university_id: 'manchester', building_id: 'man_engineering_a', name: 'MECD (Engineering)', lat: 53.46930, long: -2.23510, subjects: 'Engineering' },
    { university_id: 'manchester', building_id: 'man_stopford', name: 'Stopford Building', lat: 53.46460, long: -2.23300, subjects: 'Medicine; Dentistry' },
    { university_id: 'manchester', building_id: 'man_business', name: 'Alliance Manchester Business School', lat: 53.46650, long: -2.23660, subjects: 'Business; Finance' },

    // --- LEEDS ---
    { university_id: 'leeds', building_id: 'leeds_engineering', name: 'School of Engineering', lat: 53.80920, long: -1.55290, subjects: 'Engineering; Computing' },
    { university_id: 'leeds', building_id: 'leeds_worsley', name: 'Worsley Building', lat: 53.80180, long: -1.55240, subjects: 'Medicine; Health' },
    { university_id: 'leeds', building_id: 'leeds_parkinson', name: 'Parkinson Building', lat: 53.80550, long: -1.55430, subjects: 'History; Languages' },
    { university_id: 'leeds', building_id: 'leeds_business', name: 'Maurice Keyworth Building', lat: 53.80870, long: -1.56150, subjects: 'Business; Law' },

    // --- LIVERPOOL ---
    { university_id: 'liverpool', building_id: 'liv_engineering', name: 'Harrison Hughes Building', lat: 53.40610, long: -2.96540, subjects: 'Engineering' },
    { university_id: 'liverpool', building_id: 'liv_science', name: 'Central Teaching Hub', lat: 53.40530, long: -2.96310, subjects: 'Science; Physics; Chemistry' },
    { university_id: 'liverpool', building_id: 'liv_med', name: 'Cedar House', lat: 53.40200, long: -2.96400, subjects: 'Medicine' },
    { university_id: 'liverpool', building_id: 'liv_business', name: 'Management School', lat: 53.40260, long: -2.96020, subjects: 'Business; Management' },

    // --- SHEFFIELD ---
    { university_id: 'sheffield', building_id: 'sheff_diamond', name: 'The Diamond', lat: 53.38140, long: -1.48840, subjects: 'Engineering; Library' },
    { university_id: 'sheffield', building_id: 'sheff_arts', name: 'Jessop West', lat: 53.38200, long: -1.48500, subjects: 'Arts; Humanities; Languages' },
    { university_id: 'sheffield', building_id: 'sheff_med', name: 'Medical School', lat: 53.37600, long: -1.49400, subjects: 'Medicine' },

    // --- YORK ---
    { university_id: 'york', building_id: 'york_west', name: 'Campus West (Main)', lat: 53.94630, long: -1.05320, subjects: 'Science; Arts; Main Campus' },
    { university_id: 'york', building_id: 'york_east', name: 'Campus East', lat: 53.94700, long: -1.03000, subjects: 'Law; Management; Computer Science' },

    // --- NEWCASTLE ---
    { university_id: 'newcastle', building_id: 'ncl_armstrong', name: 'Armstrong Building', lat: 54.97830, long: -1.61780, subjects: 'Arts; Humanities; Engineering' },
    { university_id: 'newcastle', building_id: 'ncl_med', name: 'Medical School', lat: 54.98100, long: -1.62300, subjects: 'Medicine' },
    { university_id: 'newcastle', building_id: 'ncl_business', name: 'Business School', lat: 54.97200, long: -1.62500, subjects: 'Business' },

    // --- DURHAM ---
    { university_id: 'durham', building_id: 'durham_science', name: 'Science Site (South Rd)', lat: 54.76750, long: -1.57140, subjects: 'Chemistry; Physics; Biology' },
    { university_id: 'durham', building_id: 'durham_elvet', name: 'Elvet Riverside', lat: 54.77400, long: -1.56800, subjects: 'Arts; Humanities; Languages' },
    { university_id: 'durham', building_id: 'durham_law', name: 'Durham Law School', lat: 54.76600, long: -1.57200, subjects: 'Law' },

    // --- LANCASTER ---
    { university_id: 'lancaster', building_id: 'lancs_main', name: 'Bailrigg Campus (Main)', lat: 54.01040, long: -2.78770, subjects: 'Main Campus; Arts; Science' },
    { university_id: 'lancaster', building_id: 'lancs_management', name: 'Management School', lat: 54.00900, long: -2.78500, subjects: 'Business; Management' },

    // --- CHESTER ---
    { university_id: 'chester', building_id: 'chester_parkgate', name: 'Parkgate Road Campus', lat: 53.19940, long: -2.89440, subjects: 'Main Campus; Arts; Science' },
    { university_id: 'chester', building_id: 'chester_business', name: 'Queen\'s Park Campus', lat: 53.18700, long: -2.88800, subjects: 'Business' },

    // --- DURHAM QUEENS (Stockton) ---
    { university_id: 'durham_queens', building_id: 'durham_queens_main', name: 'Queen\'s Campus', lat: 54.56180, long: -1.29170, subjects: 'International Study Centre' },


    // ================= SCOTLAND =================

    // --- EDINBURGH ---
    { university_id: 'edinburgh', building_id: 'ed_old_college', name: 'Old College', lat: 55.94750, long: -3.18730, subjects: 'Law' },
    { university_id: 'edinburgh', building_id: 'ed_informatics', name: 'Informatics Forum', lat: 55.94490, long: -3.18710, subjects: 'Computer Science; AI' },
    { university_id: 'edinburgh', building_id: 'ed_kings', name: 'King\'s Buildings (Science)', lat: 55.92300, long: -3.17400, subjects: 'Science; Engineering' },
    { university_id: 'edinburgh', building_id: 'ed_med', name: 'Chancellor\'s Building', lat: 55.92130, long: -3.13640, subjects: 'Medicine' },

    // --- GLASGOW ---
    { university_id: 'glasgow', building_id: 'glas_main', name: 'Gilbert Scott Building', lat: 55.87220, long: -4.28820, subjects: 'Main Building; Arts; Humanities' },
    { university_id: 'glasgow', building_id: 'glas_med', name: 'Wolfson Medical School', lat: 55.87300, long: -4.29400, subjects: 'Medicine' },
    { university_id: 'glasgow', building_id: 'glas_eng', name: 'James Watt Building', lat: 55.87150, long: -4.28900, subjects: 'Engineering' },
    { university_id: 'glasgow', building_id: 'glas_library', name: 'University Library', lat: 55.87350, long: -4.28950, subjects: 'Library' },

    // --- ABERDEEN ---
    { university_id: 'aberdeen', building_id: 'abd_kings', name: 'King\'s College (Old)', lat: 57.16300, long: -2.10100, subjects: 'Arts; Law; Theology' },
    { university_id: 'aberdeen', building_id: 'abd_library', name: 'Sir Duncan Rice Library', lat: 57.16100, long: -2.10500, subjects: 'Library; Study' },
    { university_id: 'aberdeen', building_id: 'abd_med', name: 'Foresterhill Campus', lat: 57.15800, long: -2.13500, subjects: 'Medicine; Dentistry' },

    // --- DUNDEE ---
    { university_id: 'dundee', building_id: 'dundee_main', name: 'City Campus', lat: 56.46230, long: -2.98140, subjects: 'Main Campus; Science; Arts' },
    { university_id: 'dundee', building_id: 'dundee_art', name: 'Duncan of Jordanstone College', lat: 56.45700, long: -2.97800, subjects: 'Art; Design' },
    { university_id: 'dundee', building_id: 'dundee_med', name: 'Ninewells Campus', lat: 56.46400, long: -3.03700, subjects: 'Medicine; Nursing' },


    // ================= IRELAND & NI =================

    // --- TRINITY COLLEGE DUBLIN ---
    { university_id: 'trinity_dublin', building_id: 'tcd_front', name: 'Front Square', lat: 53.34380, long: -6.25460, subjects: 'Arts; Humanities; History' },
    { university_id: 'trinity_dublin', building_id: 'tcd_science', name: 'Hamilton Building', lat: 53.34400, long: -6.25100, subjects: 'Science; Computer Science' },
    { university_id: 'trinity_dublin', building_id: 'tcd_business', name: 'Trinity Business School', lat: 53.34350, long: -6.25200, subjects: 'Business; Finance' },
    { university_id: 'trinity_dublin', building_id: 'tcd_med', name: 'TBSI (Biomedical)', lat: 53.34250, long: -6.25150, subjects: 'Medicine; Biomedical Science' },

    // --- QUEENS BELFAST ---
    { university_id: 'queens_belfast', building_id: 'qub_lanyon', name: 'Lanyon Building', lat: 54.58460, long: -5.93400, subjects: 'Main Building; Arts; Humanities' },
    { university_id: 'queens_belfast', building_id: 'qub_med', name: 'Medical Biology Centre', lat: 54.58200, long: -5.93800, subjects: 'Medicine; Biology' },
    { university_id: 'queens_belfast', building_id: 'qub_eng', name: 'Ashby Building', lat: 54.58050, long: -5.93500, subjects: 'Engineering; Physics' },

    // --- GALWAY ---
    { university_id: 'galway', building_id: 'nuig_quad', name: 'The Quadrangle', lat: 53.27940, long: -9.06270, subjects: 'Main Campus; Arts; Admin' },
    { university_id: 'galway', building_id: 'nuig_eng', name: 'Alice Perry Engineering Building', lat: 53.28200, long: -9.06100, subjects: 'Engineering' },
    { university_id: 'galway', building_id: 'nuig_science', name: 'Science Building', lat: 53.28000, long: -9.06000, subjects: 'Science' },

    // --- CORK (UCC) ---
    { university_id: 'ucc_cork', building_id: 'ucc_quad', name: 'Main Quadrangle', lat: 51.89230, long: -8.49270, subjects: 'Main Campus; Arts' },
    { university_id: 'ucc_cork', building_id: 'ucc_science', name: 'Kane Building', lat: 51.89300, long: -8.49100, subjects: 'Science; Chemistry' },
    { university_id: 'ucc_cork', building_id: 'ucc_med', name: 'Brookfield Health Sciences', lat: 51.89000, long: -8.49800, subjects: 'Medicine; Nursing' }
];

async function runUpload() {
    console.log(`Uploading ${GOLDEN_BUILDINGS.length} curated buildings...`);

    const { error } = await supabase
        .from('university_buildings')
        .upsert(GOLDEN_BUILDINGS, { onConflict: 'building_id' });

    if (error) {
        console.error('❌ Upload Failed:', error.message);
    } else {
        console.log('✅ Success! Golden data is now in Supabase.');
    }
}

runUpload();