import { BlogPost } from '../blogTypes';

export const VEHICLE_DOCS_INSURANCE_ARTICLES: BlogPost[] = [
  // 42. Car Insurance कब Renew करना चाहिए?
  {
    slug: 'car-insurance-kab-renew-karna-chahiye',
    title: 'Car Insurance कब Renew करना चाहिए? 30-Day Expiry Rule, NCB Loss & Fine',
    h1: 'Car Insurance कब Renew करना चाहिए? (Renewal Rules, NCB Protection & Fines)',
    metaDescription: 'कार या बाइक का इंश्योरेंस एक्सपायरी से कितने दिन पहले रिन्यू कराना चाहिए? जानिए नो क्लेम बोनस (NCB 50%), ब्रेक-इन इंस्पेक्शन और ₹2,000 चालान से बचने के नियम।',
    searchIntent: 'warranty',
    directAnswer: 'वाहन बीमा को पॉलिसी समाप्त होने की तारीख से 15 से 30 दिन पहले रिन्यू करा लेना सबसे सुरक्षित है। पॉलिसी की तारीख खत्म होते ही वाहन का कवरेज शून्य हो जाता है। 90 दिन से ज्यादा लेट होने पर जमा हुआ 20% से 50% का पूरा नो क्लेम बोनस (NCB) हमेशा के लिए रद्द हो जाता है।',
    category: 'vehicles',
    categoryDisplayName: 'Vehicle Doctor',
    readTime: '4 min read',
    author: 'Asset Doctor Motor Insurance Desk',
    publishedDate: '2026-09-01',
    updatedDate: '2026-09-12',
    intro: 'भारत में बिना वैध बीमा के गाड़ी चलाना मोटर वाहन अधिनियम 2019 की धारा 196 के तहत गंभीर अपराध है। पहली बार में ₹2,000 का चालान और दोबारा पकड़े जाने पर ₹4,000 का जुर्माना या 3 महीने तक की कैद हो सकती है। जानिए सही समय पर रिन्यू कराने के वित्तीय फायदे।',
    tableOfContents: [
      { id: 'ideal-window', title: '1. रिन्यूअल की आदर्श 30-दिन की विंडो' },
      { id: 'ncb-protection', title: '2. नो क्लेम बोनस (NCB) कैसे बचता है?' },
      { id: 'break-in-inspection', title: '3. पॉलिसी लैप्स होने पर ब्रेक-इन इंस्पेक्शन का झंझट' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'ideal-window',
        heading: 'रिन्यूअल की आदर्श 30-दिन की विंडो',
        paragraphs: [
          'बीमा कंपनियां एक्सपायरी से 30 से 45 दिन पहले रिन्यूअल कोट्स जारी कर देती हैं। पहले से रिन्यू कराने पर आपकी नई पॉलिसी पिछली पॉलिसी के खत्म होने के अगले सेकंड (12:00 AM) से ही शुरू होती है, यानी कोई दिन बर्बाद नहीं होता।',
          'आखिरी दिन तक इंतजार करने से सर्वर डाउन या पेमेंट फेलियर के कारण पॉलिसी लैप्स हो सकती है।'
        ]
      },
      {
        id: 'ncb-protection',
        heading: 'नो क्लेम बोनस (NCB) कैसे बचता है?',
        paragraphs: [
          'यदि आपने साल भर कोई क्लेम नहीं लिया, तो आपको ओन डैमेज (OD) प्रीमियम पर 20% से लेकर 50% तक का डिस्काउंट मिलता है। यह छूट कार पर नहीं, बल्कि पॉलिसीधारक पर होती है।',
          'यदि पॉलिसी एक्सपायर हुए 90 दिन बीत जाते हैं, तो यह 50% तक का डिस्काउंट पूरी तरह शून्य हो जाता है, जिससे नया प्रीमियम ₹5,000 से ₹15,000 तक महंगा हो जाता है।'
        ]
      },
      {
        id: 'break-in-inspection',
        heading: 'पॉलिसी लैप्स होने पर ब्रेक-इन इंस्पेक्शन का झंझट',
        paragraphs: [
          'यदि पॉलिसी एक्सपायर हो चुकी है, तो नई पॉलिसी जारी करने से पहले सर्वेयर कार का 360-डिग्री वीडियो इंस्पेक्शन करता है। अगर कार पर कोई पुराना डेंट या खरोंच है, तो उसे पॉलिसी से हमेशा के लिए बाहर (Permanently Excluded) कर दिया जाता है।'
        ]
      }
    ],
    professionalServiceNote: 'यदि आपके वाहन से कोई तीसरा व्यक्ति घायल हो जाता है और उस समय बीमा लैप्स था, तो मोटर एक्सीडेंट क्लेम्स ट्रिब्यूनल (MACT) का लाखों रुपये का मुआवजा सीधे मालिक की निजी संपत्ति से वसूला जाता है।',
    faqs: [
      {
        question: 'क्या पुरानी कार बेचते समय NCB नई कार पर ट्रांसफर हो सकता है?',
        answer: 'हाँ! बीमा कंपनी से "NCB Reserving Certificate" लेकर आप अपना 50% बोनस अपनी नई कार के प्रीमियम पर ट्रांसफर करवा सकते हैं।'
      }
    ],
    relatedToolSlug: 'tools/service-due-calculator',
    relatedToolName: 'Vehicle Service Due Estimator',
    relatedArticleSlugs: [
      'zero-dep-vs-comprehensive-insurance',
      'vehicle-documents-kaun-kaun-se-rakhne-chahiye'
    ],
    isPublished: true
  },

  // 43. PUC Certificate Online कैसे Check करें?
  {
    slug: 'puc-kaise-check-kare',
    title: 'PUC Certificate Online कैसे Check करें? Parivahan Status & ₹10,000 Fine Guide',
    h1: 'PUC Certificate Online कैसे Check करें? (Parivahan PUC Status & Validity)',
    metaDescription: 'गाड़ी का प्रदूषण प्रमाण पत्र (PUC) ऑनलाइन कैसे चेक और डाउनलोड करें? जानिए परिवहन सेवा पोर्टल, BS4 vs BS6 वाहनों की 1 साल की वैलिडिटी और ₹10,000 जुर्माने से बचाव।',
    searchIntent: 'how-to',
    directAnswer: 'गाड़ी का PUC स्टेटस चेक करने के लिए Parivahan Sewa पोर्टल (parivahan.gov.in/puc) पर जाएं, अपना वाहन रजिस्ट्रेशन नंबर और चेसिस के अंतिम 5 अंक दर्ज करें। वहां से आप अपना ओरिजिनल डिजिटल पीयूसी सर्टिफिकेट तुरंत पीडीएफ में डाउनलोड कर सकते हैं।',
    category: 'vehicles',
    categoryDisplayName: 'Vehicle Doctor',
    readTime: '3 min read',
    author: 'Asset Doctor Legal & Compliance Desk',
    publishedDate: '2026-09-03',
    updatedDate: '2026-09-12',
    intro: 'मोटर व्हीकल एक्ट की धारा 190(2) के तहत बिना वैध प्रदूषण प्रमाण पत्र (PUC) के वाहन चलाने पर सीधे ₹10,000 का चालान और 3 महीने के लिए ड्राइविंग लाइसेंस सस्पेंड हो सकता है। जानिए अपने वाहन की वैलिडिटी कैसे जांचें।',
    tableOfContents: [
      { id: 'validity-rules', title: '1. नई कार और पुरानी गाड़ी की PUC वैलिडिटी कितने दिन होती है?' },
      { id: 'step-by-step-check', title: '2. ऑनलाइन चेक और डाउनलोड करने के 3 आसान स्टेप्स' },
      { id: 'fine-warning', title: '3. ₹10,000 का ट्रैफिक चालान नियम' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'validity-rules',
        heading: 'नई कार और पुरानी गाड़ी की PUC वैलिडिटी कितने दिन होती है?',
        paragraphs: [
          '• नई कार/बाइक: शोरूम से नई गाड़ी खरीदने पर पहले 1 साल तक किसी अलग PUC की जरूरत नहीं होती।',
          '• BS-IV और BS-VI वाहन: 1 साल पूरा होने के बाद कराई गई हर जांच की वैधता पूरे 12 महीने (1 साल) की होती है।',
          '• पुराने BS-III या उससे पुराने वाहन: केवल 6 महीने की वैधता मिलती है।'
        ]
      },
      {
        id: 'step-by-step-check',
        heading: 'ऑनलाइन चेक और डाउनलोड करने के 3 आसान स्टेप्स',
        paragraphs: [
          'सर्टिफिकेट ऑनलाइन प्राप्त करने का तरीका:'
        ],
        practicalSteps: [
          '1. parivahan.gov.in/puc पोर्टल खोलें।',
          '2. "PUC Certificate" टैब पर क्लिक करें।',
          '3. अपना वाहन नंबर (उदा. DL01AB1234) और चेसिस नंबर के अंतिम 5 अंक डालें और कैप्चा भरें। आपका सर्टिफिकेट स्क्रीन पर आ जाएगा।'
        ]
      }
    ],
    faqs: [
      {
        question: 'क्या इलेक्ट्रिक वाहनों (EV) के लिए भी PUC जरूरी है?',
        answer: 'नहीं! 100% बैटरी चालित इलेक्ट्रिक वाहनों (Electric Vehicles) में कोई साइलेंसर या एग्जॉस्ट गैस नहीं होती, इसलिए इन्हें PUC प्रमाण पत्र से पूर्ण छूट प्राप्त है।'
      }
    ],
    relatedToolSlug: 'tools/warranty-calculator',
    relatedToolName: 'Expiry Countdown Calculator',
    relatedArticleSlugs: [
      'car-insurance-kab-renew-karna-chahiye',
      'vehicle-documents-kaun-kaun-se-rakhne-chahiye'
    ],
    isPublished: true
  },

  // 44. गाड़ी में कौन-कौन से Documents रखने जरूरी हैं?
  {
    slug: 'vehicle-documents-kaun-kaun-se-rakhne-chahiye',
    title: 'गाड़ी में कौन-कौन से Documents रखने जरूरी हैं? DigiLocker & MParivahan Rules',
    h1: 'गाड़ी में कौन-कौन से Documents रखने जरूरी हैं? (RTO Rules & Digital App Guide)',
    metaDescription: 'ट्रैफिक पुलिस चेकिंग के समय कौन से 4 दस्तावेज दिखाने जरूरी हैं? जानिए डिजीलॉकर और एम-परिवहन की कानूनी मान्यता और भारी चालान से बचने के नियम।',
    searchIntent: 'informational',
    directAnswer: 'भारत में सड़क पर वाहन चलाते समय 4 अनिवार्य दस्तावेज होने चाहिए: 1) ड्राइविंग लाइसेंस (DL), 2) वाहन का रजिस्ट्रेशन सर्टिफिकेट (RC), 3) वैध मोटर इंश्योरेंस पॉलिसी, और 4) वैध पॉल्यूशन अंडर कंट्रोल (PUC) सर्टिफिकेट। केंद्र सरकार के IT एक्ट के तहत DigiLocker और mParivahan में दिखाए गए डिजिटल दस्तावेज ओरिजिनल के समान 100% कानूनी रूप से मान्य हैं।',
    category: 'vehicles',
    categoryDisplayName: 'Vehicle Doctor',
    readTime: '4 min read',
    author: 'Asset Doctor Legal & Compliance Desk',
    publishedDate: '2026-09-05',
    updatedDate: '2026-09-12',
    intro: 'सड़क पर पुलिस चेकिंग के दौरान अगर कोई कागज़ घर छूट जाए तो भारी जुर्माना भुगतना पड़ता है। लेकिन सड़क परिवहन एवं राजमार्ग मंत्रालय (MoRTH) के आधिकारिक सर्कुलर के अनुसार अब आपको मूल हार्ड कॉपी साथ लेकर चलने की आवश्यकता नहीं है।',
    tableOfContents: [
      { id: 'mandatory-4-docs', title: '1. 4 अनिवार्य दस्तावेज और उनके चालान' },
      { id: 'digilocker-validity', title: '2. क्या ट्रैफिक पुलिस डिजीलॉकर मानने से मना कर सकती है?' },
      { id: 'commercial-docs', title: '3. कमर्शियल वाहनों के लिए 2 अतिरिक्त कागजात' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'digilocker-validity',
        heading: 'क्या ट्रैफिक पुलिस डिजीलॉकर मानने से मना कर सकती है?',
        paragraphs: [
          'केंद्रीय मोटर वाहन नियम (CMVR) 139 के तहत डिजीलॉकर या एम-परिवहन पर डिजिटल रूप में प्रस्तुत दस्तावेज को किसी भी राज्य की पुलिस या RTO अस्वीकार नहीं कर सकता।',
          'ध्यान रखें: व्हाट्सएप पर रखी साधारण फोटो या मोबाइल गैलरी में सेव पीडीएफ कानूनी रूप से मान्य नहीं हैं; दस्तावेज आधिकारिक डिजीलॉकर ऐप से ही खुले होने चाहिए।'
        ]
      }
    ],
    faqs: [
      {
        question: 'अगर मौके पर कोई दस्तावेज न हो तो क्या तुरंत चालान भरना पड़ेगा?',
        answer: 'यदि आपके पास वैध दस्तावेज है पर आप दिखा नहीं पा रहे हैं, तो आप चालान कटने के 15 दिनों के भीतर ट्रैफिक कोर्ट या RTO में मूल कागजात प्रस्तुत करके मात्र ₹100 का नाममात्र शुल्क देकर चालान रद्द करवा सकते हैं।'
      }
    ],
    relatedToolSlug: 'tools/warranty-calculator',
    relatedToolName: 'Document Expiry Tracker',
    relatedArticleSlugs: [
      'car-insurance-kab-renew-karna-chahiye',
      'puc-kaise-check-kare'
    ],
    isPublished: true
  },

  // 45. Zero Depreciation vs Comprehensive Insurance
  {
    slug: 'zero-dep-vs-comprehensive-insurance',
    title: 'Zero Depreciation vs Comprehensive Insurance: कौन सा बीमा लेना चाहिए?',
    h1: 'Zero Depreciation vs Comprehensive Insurance: कौन सा बीमा लेना चाहिए? (Bumper to Bumper Guide)',
    metaDescription: 'जीरो डेप्रिसिएशन (Zero Dep/Bumper to Bumper) और सामान्य कॉम्प्रिहेंसिव कार इंश्योरेंस में क्या अंतर है? जानिए प्लास्टिक, ग्लास, रबर पार्ट्स पर क्लेम की हकीकत।',
    searchIntent: 'comparison',
    directAnswer: '5 साल तक पुरानी कार के लिए हमेशा जीरो डेप्रिसिएशन (Zero Dep/Bumper to Bumper) एड-ऑन लेना चाहिए। सामान्य कॉम्प्रिहेंसिव पॉलिसी में एक्सीडेंट होने पर रबर और प्लास्टिक बंपर पर 50%, फाइबर ग्लास पर 30% और मेटल पर 10-40% डेप्रिसिएशन कट जाता है, जबकि जीरो डेप में 100% क्लेम मिलता है।',
    category: 'vehicles',
    categoryDisplayName: 'Vehicle Doctor',
    readTime: '4 min read',
    author: 'Asset Doctor Motor Insurance Desk',
    publishedDate: '2026-09-07',
    updatedDate: '2026-09-12',
    intro: 'गाड़ी का एक्सीडेंट होने पर जब ₹50,000 का बिल बनता है, तो सामान्य कॉम्प्रिहेंसिव पॉलिसी होने पर बीमा कंपनी अक्सर सिर्फ ₹25,000 या ₹30,000 ही पास करती है। बची हुई रकम ग्राहक को अपनी जेब से देनी पड़ती है। जानिए क्यों जीरो डेप हर नए वाहन के लिए अनिवार्य है।',
    tableOfContents: [
      { id: 'depreciation-table', title: '1. सामान्य पॉलिसी में किस पार्ट पर कितना पैसा कटता है?' },
      { id: 'zero-dep-benefits', title: '2. जीरो डेप के 3 सबसे बड़े फायदे' },
      { id: 'compulsory-deductible', title: '3. कम्पलसरी डिडक्टिबल (₹1,000-₹2,000) क्या होता है?' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'depreciation-table',
        heading: 'सामान्य पॉलिसी में किस पार्ट पर कितना पैसा कटता है?',
        paragraphs: [
          'IRDAI के नियमों के अनुसार सामान्य कॉम्प्रिहेंसिव पॉलिसी में कटौती की दरें:',
          '• रबर, नायलॉन और प्लास्टिक पार्ट्स (बंपर, हेडलाइट केसिंग, टायर): 50% कटौती',
          '• फाइबर ग्लास के पार्ट्स: 30% कटौती',
          '• कांच (Windshield, Window Glass): 0% कटौती (पूरा भुगतान)',
          'जीरो डेप एड-ऑन लेने पर प्लास्टिक और फाइबर पर लगने वाली यह 50% तक की भारी कटौती पूरी तरह माफ हो जाती है।'
        ]
      }
    ],
    faqs: [
      {
        question: 'जीरो डेप पॉलिसी अधिकतम कितने साल तक मिल सकती है?',
        answer: 'अधिकांश बीमा कंपनियां कार की उम्र 5 साल होने तक जीरो डेप एड-ऑन देती हैं। कुछ चुनिंदा कंपनियां इसे 7 साल तक भी ऑफर करती हैं।'
      }
    ],
    relatedToolSlug: 'tools/repair-vs-replace',
    relatedToolName: 'Repair vs Replace Calculator',
    relatedArticleSlugs: [
      'car-insurance-kab-renew-karna-chahiye',
      'vehicle-documents-kaun-kaun-se-rakhne-chahiye'
    ],
    isPublished: true
  },

  // 46. Car & Bike Warranty कैसे Check करें?
  {
    slug: 'vehicle-warranty-kaise-check-kare',
    title: 'Car & Bike Warranty कैसे Check करें? Extended Warranty & Void Conditions',
    h1: 'Car & Bike Warranty कैसे Check करें? (Manufacturer Standard vs Extended Warranty)',
    metaDescription: 'कार और बाइक की 3 साल/1 लाख KM वारंटी कैसे चेक करें? जानिए एक्सटेंडेड वारंटी, सीएनजी किट या बाहर से वायरिंग कटवाने पर वारंटी रद्द होने के कड़े नियम।',
    searchIntent: 'warranty',
    directAnswer: 'वाहन की वारंटी चेक करने के लिए डीलर इनवॉइस या सर्विस बुकलेट में दर्ज खरीद तिथि और किलोमीटर देखें। सामान्यतः 3 साल/1,00,000 KM की स्टैंडर्ड वारंटी मिलती है जिसे 5 या 7 साल तक बढ़ाया जा सकता है। बाहर से तार छिलवाने, आफ्टरमार्केट CNG लगाने या अनधिकृत गैराज में सर्विस कराने से वारंटी तुरंत रद्द हो जाती है।',
    category: 'warranty',
    categoryDisplayName: 'Warranty & Invoices',
    readTime: '4 min read',
    author: 'Asset Doctor Legal & Automotive Desk',
    publishedDate: '2026-09-08',
    updatedDate: '2026-09-12',
    intro: 'आधुनिक कारों में ईसीयू (ECU), ऑटोमैटिक ट्रांसमिशन और टर्बोचार्जर जैसे महंगे कंपोनेंट्स होते हैं जिनकी कीमत ₹80,000 से ₹3,00,000 तक होती है। यदि आपकी वारंटी वैध है, तो ये सभी मैन्युफैक्चरिंग डिफेक्ट्स फ्री में बदले जाते हैं।',
    tableOfContents: [
      { id: 'warranty-types', title: '1. स्टैंडर्ड vs एक्सटेंडेड वारंटी' },
      { id: 'warranty-void-traps', title: '2. 5 गलतियां जो आपकी वारंटी को खत्म कर देती हैं' },
      { id: 'how-to-check', title: '3. VIN / चेसिस नंबर से स्टेटस कैसे देखें' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'warranty-void-traps',
        heading: '5 गलतियां जो आपकी वारंटी को खत्म कर देती हैं',
        paragraphs: [
          'कंपनियां इन आधारों पर क्लेम तुरंत रिजेक्ट करती हैं:'
        ],
        practicalSteps: [
          '1. आफ्टरमार्केट म्यूजिक सिस्टम, सबवूफर या हेडलाइट के लिए मूल वायरिंग हार्नेस काटना (Wire Splicing)। हमेशा कपलर-टू-कपलर फिटिंग कराएं।',
          '2. अनऑथराइज्ड सेंटर से आफ्टरमार्केट सीएनजी/एलपीजी किट लगवाना।',
          '3. गैर-अनुशंसित इंजन ऑयल या ऑयल एडिटिव्स का उपयोग करना।',
          '4. शेड्यूल सर्विस में 1,500 KM से अधिक की देरी करना या लोकल मैकेनिक से कराना।',
          '5. कार के ईसीयू को रीमैप या ट्यून कराना।'
        ]
      }
    ],
    faqs: [
      {
        question: 'क्या डीलर से एक्सटेंडेड वारंटी लेना फायदेमंद है?',
        answer: 'हाँ, कार की एक्सटेंडेड वारंटी प्रीमियम के मुकाबले बहुत सस्ती होती है (लगभग ₹10,000-₹20,000) और यह 5 साल तक भारी रिपेयर बिल और मानसिक तनाव से पूरी सुरक्षा देती है।'
      }
    ],
    relatedToolSlug: 'tools/warranty-calculator',
    relatedToolName: 'Warranty Expiry Calculator',
    relatedArticleSlugs: [
      'car-service-kitne-km-par-karni-chahiye',
      'car-service-history-kaise-maintain-kare'
    ],
    isPublished: true
  }
];
