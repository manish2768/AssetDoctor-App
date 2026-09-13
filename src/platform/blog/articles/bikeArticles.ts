import { BlogPost } from '../blogTypes';

export const BIKE_ARTICLES: BlogPost[] = [
  // 38. Bike Service कितने KM पर करनी चाहिए?
  {
    slug: 'bike-service-kitne-km-par-karni-chahiye',
    title: 'Bike Service कितने KM पर करनी चाहिए? 3000 KM Rule & Chain Maintenance',
    h1: 'Bike Service कितने KM पर करनी चाहिए? (Motorcycle & Scooter Maintenance Guide)',
    metaDescription: 'बाइक या स्कूटर की सर्विस कितने किलोमीटर या कितने महीने में करानी चाहिए? जानिए 3,000 KM का नियम, इंजन ऑयल, चेन ल्यूब, स्पार्क प्लग और ब्रेक पैड चेकलिस्ट।',
    searchIntent: 'maintenance',
    directAnswer: '100cc से 150cc कम्यूटर बाइक्स और स्कूटर्स (Activa, Splendor, Pulsar) की सर्विस हर 3,000 से 4,000 किलोमीटर या 3 से 4 महीने (जो भी पहले आए) पर करानी चाहिए। प्रीमियम बाइक्स (250cc+) फुली सिंथेटिक ऑयल के साथ हर 5,000 से 6,000 KM पर सर्विस होती हैं।',
    category: 'vehicles',
    categoryDisplayName: 'Vehicle Doctor',
    readTime: '4 min read',
    author: 'Asset Doctor Two-Wheeler Lab',
    publishedDate: '2026-09-03',
    updatedDate: '2026-09-12',
    intro: 'भारतीय सड़कों पर बाइक हमारी रोजमर्रा की जीवनरेखा है। कम सीसी वाले इंजनों में केवल 900ml से 1 लीटर इंजन ऑयल होता है। समय पर ऑयल न बदलने पर इंजन जरूरत से ज्यादा गर्म होता है और पिस्टन रिंग्स घिस जाती हैं।',
    tableOfContents: [
      { id: 'service-schedule', title: '1. कम्यूटर vs प्रीमियम बाइक का सर्विस अंतराल' },
      { id: 'essential-checklist', title: '2. हर सर्विस पर 5 अनिवार्य काम' },
      { id: 'chain-care', title: '3. ड्राइव चेन क्लीनिंग और ल्यूब (हर 500 KM)' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'essential-checklist',
        heading: 'हर सर्विस पर 5 अनिवार्य काम',
        paragraphs: [
          '• 1. इंजन ऑयल चेंज (4T 10W-30 या 20W-40 JASO MA2 ग्रेड)',
          '• 2. एयर फिल्टर क्लीनिंग या रिप्लेसमेंट (माइलेज के लिए सबसे जरूरी)',
          '• 3. स्पार्क प्लग गैप चेक और कार्बन सफाई',
          '• 4. ड्राइव चेन की ढीलापन (Chain Slack) एडजस्टमेंट और ल्यूब्रिकेशन',
          '• 5. फ्रंट और रियर ब्रेक शू/पैड्स की घिसावट चेक'
        ],
        tip: 'चेन पर कभी भी इस्तेमाल किया हुआ काला इंजन ऑयल न डालें। इससे रेत चिपकती है और चेन-स्प्रॉकेट समय से पहले कट जाता है।'
      }
    ],
    professionalServiceNote: 'अगर बाइक से चलते समय क्लच स्लिप हो रहा है (एक्सीलेटर देने पर आवाज बढ़ती है पर स्पीड नहीं बढ़ती) या इंजन से टिकटिक की तेज आवाज (Tappet clearance issue) आ रही है, तो तुरंत ऑथराइज्ड मैकेनिक को दिखाएं।',
    faqs: [
      {
        question: 'स्कूटर (जैसे Activa) में गियर ऑयल कब बदलना चाहिए?',
        answer: 'स्कूटर के पिछले पहिए के गियरबॉक्स में 120ml गियर ऑयल होता है जिसे हर 8,000 से 10,000 KM पर बदलना जरूरी होता है।'
      }
    ],
    relatedToolSlug: 'tools/service-due-calculator',
    relatedToolName: 'Two-Wheeler Service Due Estimator',
    relatedArticleSlugs: [
      'bike-mileage-kaise-badhaye',
      'bike-battery-life-in-india'
    ],
    isPublished: true
  },

  // 39. Bike का माइलेज कम क्यों हो गया?
  {
    slug: 'bike-mileage-kaise-badhaye',
    title: 'Bike का माइलेज कम क्यों हो गया? माइलेज 20% बढ़ाने के 6 प्रैक्टिकल टिप्स',
    h1: 'Bike का माइलेज कम क्यों हो गया? (6 Practical Fuel Saving Tips for Two-Wheelers)',
    metaDescription: 'बाइक या स्कूटर का पेट्रोल बहुत जल्दी खत्म हो रहा है? जानिए टायर प्रेशर, गंदा एयर फिल्टर, क्लच लीवर दबाकर चलाना और माइलेज 10-15 kmpl बढ़ाने के व्यावहारिक उपाय।',
    searchIntent: 'problem-solving',
    directAnswer: 'बाइक का माइलेज गिरने के 3 सबसे बड़े कारण हैं: 1) टायरों में कम हवा (Low Tyre Pressure), 2) धूल से चोक एयर फिल्टर जिससे इंजन को ज्यादा पेट्रोल खींचना पड़ता है, और 3) राइडिंग के दौरान क्लच लीवर पर उंगली रखकर हाफ-क्लच में बाइक चलाना।',
    category: 'vehicles',
    categoryDisplayName: 'Vehicle Doctor',
    readTime: '4 min read',
    author: 'Asset Doctor Two-Wheeler Lab',
    publishedDate: '2026-09-05',
    updatedDate: '2026-09-12',
    intro: 'पेट्रोल की बढ़ती कीमतों के बीच अगर आपकी 60 kmpl देने वाली बाइक अचानक 40-45 kmpl पर आ जाए, तो हर महीने पेट्रोल का बजट बिगड़ जाता है। कुछ मामूली आदतों और सेटिंग्स को ठीक करके आप माइलेज तुरंत बढ़ा सकते हैं।',
    tableOfContents: [
      { id: 'top-reasons', title: '1. माइलेज गिरने के 4 मुख्य कारण' },
      { id: 'practical-tips', title: '2. माइलेज 20% सुधारने के 6 टिप्स' },
      { id: 'faqs', title: '3. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'practical-tips',
        heading: 'माइलेज 20% सुधारने के 6 टिप्स',
        paragraphs: [
          'इन बातों का विशेष ध्यान रखें:'
        ],
        practicalSteps: [
          'हर हफ्ते ठंडे टायरों में सही हवा (Front: 25-28 PSI, Rear: 32-36 PSI) चेक कराएं।',
          'इकोनॉमी स्पीड (40 से 55 km/h) पर चौथे या पांचवें गियर में चलें।',
          'क्लच लीवर पर बेवजह हाथ न रखें; गियर बदलने के बाद क्लच को पूरी तरह छोड़ें।',
          'हर 6,000 KM पर ₹150 का नया एयर फिल्टर लगवाएं।',
          'ट्रैफिक सिग्नल पर 30 सेकंड से ज्यादा रुकना हो तो इंजन बंद (Engine Kill Switch) करें।',
          'चेन को हमेशा साफ और सही तनाव (15-20mm स्लैक) पर रखें।'
        ]
      }
    ],
    faqs: [
      {
        question: 'क्या कार्बोरेटर या फ्यूल इंजेक्शन (FI) ट्यूनिंग से माइलेज बढ़ता है?',
        answer: 'हाँ, अगर स्पार्क प्लग पर काला कार्बन जमा है तो इसका मतलब मिक्सचर "रिच" (ज्यादा पेट्रोल) है। ट्यूनिंग कराने से माइलेज तुरंत सुधर जाता है।'
      }
    ],
    relatedToolSlug: 'tools/service-due-calculator',
    relatedToolName: 'Vehicle Service Due Estimator',
    relatedArticleSlugs: [
      'bike-service-kitne-km-par-karni-chahiye',
      'scooter-vs-bike-maintenance-cost'
    ],
    isPublished: true
  },

  // 40. Two-Wheeler Battery कितने साल चलती है?
  {
    slug: 'bike-battery-life-in-india',
    title: 'Two-Wheeler Battery कितने साल चलती है? Self-Start Problem Solutions',
    h1: 'Two-Wheeler Battery कितने साल चलती है? (Motorcycle & Scooter Battery Life)',
    metaDescription: 'बाइक की बैटरी कितने साल चलती है? जानिए 2.5 से 4 साल की लाइफ, सेल्फ स्टार्ट न लेने के लक्षण, मेंटेनेंस-फ्री (MF) बैटरी और वारंटी क्लेम करने की प्रक्रिया।',
    searchIntent: 'informational',
    directAnswer: 'दोपहिया वाहनों की मेंटेनेंस-फ्री (MF/VRLA) बैटरी की औसत उम्र 3 से 4 साल होती है। अगर बाइक हफ्तों तक खड़ी रहे या उसमें अतिरिक्त हॉर्न/एलईडी लाइट लगी हो, तो बैटरी 2 से 2.5 साल में भी डिस्चार्ज हो सकती है।',
    category: 'vehicles',
    categoryDisplayName: 'Vehicle Doctor',
    readTime: '3 min read',
    author: 'Asset Doctor Two-Wheeler Lab',
    publishedDate: '2026-09-07',
    updatedDate: '2026-09-12',
    intro: 'आजकल अधिकांश स्कूटर्स और आधुनिक बाइक्स में किक-स्टार्टर (Kick Lever) नहीं होता। ऐसे में अगर सुबह ऑफिस जाते समय सेल्फ दबाने पर सिर्फ खट-खट की आवाज आए, तो पूरा दिन खराब हो जाता है। जानिए बैटरी की सही देखभाल।',
    tableOfContents: [
      { id: 'battery-life', title: '1. दोपहिया बैटरी की औसत लाइफ' },
      { id: 'dying-signs', title: '2. कमजोर बैटरी के 3 पक्के लक्षण' },
      { id: 'winter-care', title: '3. सर्दियों में बैटरी डेड होने से कैसे बचाएं' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'dying-signs',
        heading: 'कमजोर बैटरी के 3 पक्के लक्षण',
        paragraphs: [
          '• सेल्फ बटन दबाने पर स्टार्टर मोटर घूमती नहीं है, केवल रिले से "क्लिक-क्लिक" की आवाज आती है।',
          '• हॉर्न की आवाज धीमी और फटी-फटी आती है जब इंजन बंद हो।',
          '• इंडिकेटर ऑन करने पर मीटर कंसोल की डिजिटल डिस्प्ले मद्धम पड़ जाती है।'
        ]
      }
    ],
    faqs: [
      {
        question: 'अगर बाइक कई हफ्तों तक नहीं चलानी हो तो क्या करें?',
        answer: 'बैटरी का नेगेटिव (काला) टर्मिनल स्क्रू खोलकर तार अलग कर दें। इससे पैरासिटिक ड्रेन रुक जाता है और 1 महीने बाद भी बाइक एक सेल्फ में स्टार्ट हो जाती है।'
      }
    ],
    relatedToolSlug: 'tools/asset-age-calculator',
    relatedToolName: 'Asset Age Calculator',
    relatedArticleSlugs: [
      'bike-service-kitne-km-par-karni-chahiye',
      'car-battery-kitne-saal-chalti-hai'
    ],
    isPublished: true
  },

  // 41. Scooter vs Bike Maintenance: किसका खर्च कम है?
  {
    slug: 'scooter-vs-bike-maintenance-cost',
    title: 'Scooter (Activa) vs Bike Maintenance: किसका सर्विस खर्च कम आता है?',
    h1: 'Scooter vs Bike Maintenance: किसका सर्विस खर्च कम आता है? (Cost Comparison)',
    metaDescription: 'एक्टिवा/जुपिटर जैसे गियरलेस स्कूटर और स्प्लेंडर/पल्सर जैसी मोटरसाइकिल में किसका मेंटेनेंस खर्च ज्यादा होता है? जानिए CVT बेल्ट, क्लच शू, माइलेज और 5 साल का कुल खर्च।',
    searchIntent: 'comparison',
    directAnswer: 'लंबे समय में गियर वाली कम्यूटर बाइक (जैसे Splendor, Shine) का मेंटेनेंस खर्च स्कूटर (जैसे Activa, Jupiter) की तुलना में 25% से 35% कम आता है। स्कूटर में CVT ड्राइव बेल्ट, क्लच रोलर्स और छोटे टायरों की वजह से टायर व पार्ट रिप्लेसमेंट जल्दी और महंगा होता है।',
    category: 'vehicles',
    categoryDisplayName: 'Vehicle Doctor',
    readTime: '4 min read',
    author: 'Asset Doctor Automotive Lab',
    publishedDate: '2026-09-08',
    updatedDate: '2026-09-12',
    intro: 'नया दोपहिया खरीदते समय लोग अक्सर स्कूटर की सुविधा या बाइक के माइलेज के बीच उलझते हैं। लेकिन 5 साल के कुल स्वामित्व खर्च (Total Cost of Ownership) में सर्विस और रिपेयर बिल का बड़ा हाथ होता है।',
    tableOfContents: [
      { id: 'cost-breakup', title: '1. 5 साल के मेंटेनेंस खर्च का तुलनात्मक चार्ट' },
      { id: 'cvt-belt-wear', title: '2. स्कूटर की CVT बेल्ट और क्लच का अतिरिक्त खर्च' },
      { id: 'tyre-lifespan', title: '3. 10-इंच स्कूटर टायर vs 17-इंच बाइक टायर लाइफ' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'cvt-belt-wear',
        heading: 'स्कूटर की CVT बेल्ट और क्लच का अतिरिक्त खर्च',
        paragraphs: [
          'स्कूटर में ऑटोमैटिक ट्रांसमिशन के लिए रबर की ड्राइव बेल्ट और वेरियाटर रोलर्स होते हैं, जिन्हें हर 18,000 से 20,000 KM पर बदलना पड़ता है (खर्च ₹1,200-₹1,800)।',
          'बाइक्स में चेन-स्प्रॉकेट 25,000 से 30,000 KM तक आसानी से चलता है।'
        ]
      }
    ],
    faqs: [
      {
        question: 'क्या शहर के ट्रैफिक के लिए स्कूटर का अतिरिक्त खर्च वाजिब है?',
        answer: 'हाँ, बंपर-टू-बंपर ट्रैफिक में क्लच और गियर न बदलने की शारीरिक सुविधा के लिए थोड़ा अधिक मेंटेनेंस और 15-20% कम माइलेज अधिकांश शहरी राइडर्स के लिए व्यावहारिक सौदा है।'
      }
    ],
    relatedToolSlug: 'tools/service-due-calculator',
    relatedToolName: 'Vehicle Service Due Estimator',
    relatedArticleSlugs: [
      'bike-service-kitne-km-par-karni-chahiye',
      'bike-mileage-kaise-badhaye'
    ],
    isPublished: true
  }
];
