import { BlogPost } from '../blogTypes';

export const RO_ARTICLES: BlogPost[] = [
  // 22. RO Filter कितने महीने में बदलना चाहिए?
  {
    slug: 'ro-filter-kitne-mahine-mein-badalna-chahiye',
    title: 'RO Filter कितने महीने में बदलना चाहिए? Sediment, Carbon & Membrane Timeline',
    h1: 'RO Filter कितने महीने में बदलना चाहिए? (Exact Replacement Schedule in India)',
    metaDescription: 'भारत में RO प्यूरीफायर के सेडिमेंट, प्री-कार्बन और RO मेम्ब्रेन कितने महीने में बदलने चाहिए? जानिए टीडीएस लेवल, पानी का स्वाद और फिल्टर बदलने का सही नियम।',
    searchIntent: 'maintenance',
    directAnswer: 'बाहरी प्री-फिल्टर (Spun/PP Candle) को हर 3 से 4 महीने में, इनलाइन सेडिमेंट और एक्टिवेटेड कार्बन फिल्टर को हर 9 से 12 महीने में, और मुख्य RO मेम्ब्रेन को 24 से 36 महीने (या TDS 10% से अधिक बढ़ने पर) बदलना चाहिए।',
    category: 'appliances',
    categoryDisplayName: 'Home Appliances',
    readTime: '4 min read',
    author: 'Asset Doctor Water Quality Lab',
    publishedDate: '2026-09-04',
    updatedDate: '2026-09-12',
    intro: 'पीने का साफ पानी परिवार की सेहत की पहली शर्त है। लेकिन समय पर RO फिल्टर न बदलने से न केवल पानी से अजीब स्वाद और गंध आने लगती है, बल्कि चोक फिल्टर के कारण महंगा बूस्टर पंप भी जल सकता है। जानिए प्रत्येक फिल्टर की सही उम्र।',
    tableOfContents: [
      { id: 'filter-timeline', title: '1. सभी 4 फिल्टर का रिप्लेसमेंट टाइमलाइन' },
      { id: 'warning-signs', title: '2. कैसे पता करें कि फिल्टर चोक हो चुका है?' },
      { id: 'tds-monitoring', title: '3. TDS मीटर से पानी की शुद्धता कैसे मापें?' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'filter-timeline',
        heading: 'सभी 4 फिल्टर का रिप्लेसमेंट टाइमलाइन',
        paragraphs: [
          '• 1. आउटर प्री-फिल्टर (PP Spun Bowl): हर 3 से 4 महीने में। यह पाइपलाइन की जंग, मिट्टी और कीचड़ रोकता है। जब यह सफेद से गहरा भूरा या काला हो जाए, तो तुरंत बदलें। कीमत: मात्र ₹100 से ₹150।',
          '• 2. इनलाइन सेडिमेंट फिल्टर: हर 9 से 12 महीने में। 5 माइक्रोन से छोटे महीन कण रोकता है।',
          '• 3. प्री-कार्बन ब्लॉक: हर 9 से 12 महीने में। पानी से क्लोरीन, रासायनिक कीटनाशक और खराब बदबू सोखता है। यह मेम्ब्रेन को क्लोरीन के नुकसान से बचाता है।',
          '• 4. आरओ मेम्ब्रेन (0.0001 माइक्रोन): हर 2 से 3 साल में। यह भारी धातुएं (Lead, Arsenic), फ्लोराइड और वायरस अलग करती है।'
        ],
        tip: 'प्री-फिल्टर कैंडल समय पर बदलने से महंगी RO मेम्ब्रेन की लाइफ 1 साल तक बढ़ जाती है।'
      },
      {
        id: 'warning-signs',
        heading: 'कैसे पता करें कि फिल्टर चोक हो चुका है?',
        paragraphs: [
          'अगर आपके प्यूरीफायर में निम्नलिखित में से कोई भी संकेत दिखे, तो तुरंत फिल्टर बदलें:'
        ],
        practicalSteps: [
          'टैंक भरने में दोगुना से अधिक समय लगना या नल से पतली धार आना।',
          'रिजेक्ट (वेस्ट वॉटर) पाइप से पानी लगातार बहुत तेज बहना लेकिन प्योर पानी न बनना।',
          'पानी का स्वाद हल्का कड़वा या बेस्वाद हो जाना।',
          'मशीन से लगातार बीप-बीप (Filter Change Alarm) की आवाज आना।'
        ]
      }
    ],
    professionalServiceNote: 'मेम्ब्रेन बदलते समय हमेशा ऑथराइज्ड ओरिजिनल मेम्ब्रेन (जैसे Dow Filmtec, Vontron या ब्रांडेड) ही लगवाएं। लोकल नकली मेम्ब्रेन ₹500 में टीडीएस तो कम कर देती है लेकिन हानिकारक रसायनों को छान नहीं पाती।',
    faqs: [
      {
        question: 'पीने के पानी का सही TDS कितना होना चाहिए?',
        answer: 'BIS (Bureau of Indian Standards) और WHO के अनुसार पीने के पानी का सबसे संतुलित और गुणकारी TDS 80 से 150 ppm (mg/L) के बीच होना चाहिए। 50 से नीचे जाने पर जरूरी मिनरल्स खत्म हो जाते हैं।'
      }
    ],
    relatedToolSlug: 'tools/warranty-calculator',
    relatedToolName: 'Warranty Expiry Calculator',
    relatedArticleSlugs: [
      'ro-paani-slow-kyo-karta-hai',
      'ro-service-kitne-mahine-mein-karni-chahiye'
    ],
    isPublished: true
  },

  // 23. RO पानी Slow क्यों करता है?
  {
    slug: 'ro-paani-slow-kyo-karta-hai',
    title: 'RO पानी Slow क्यों देता है? Low Pressure & Membrane Choke Fix',
    h1: 'RO पानी Slow क्यों देता है? (Reasons for Low Pure Water Flow & Fixes)',
    metaDescription: 'RO वाटर प्यूरीफायर में पानी बहुत धीरे टपक रहा है या टैंक नहीं भर रहा? जानिए सेडिमेंट चोक, बूस्टर पंप प्रेशर, एसवी वॉल्व और स्लो फ्लो ठीक करने के उपाय।',
    searchIntent: 'problem-solving',
    directAnswer: 'RO में पानी धीमा आने का 90% कारण बाहर लगा प्री-फिल्टर मिट्टी से चोक होना, इनपुट वाटर प्रेशर कम होना, या 2 साल पुरानी मेम्ब्रेन के छिद्र ब्लॉक होना है। प्री-फिल्टर कैंडल बदलने और बूस्टर पंप का प्रेशर (70-100 PSI) चेक कराने से फ्लो तुरंत ठीक हो जाता है।',
    category: 'appliances',
    categoryDisplayName: 'Home Appliances',
    readTime: '4 min read',
    author: 'Asset Doctor Water Quality Lab',
    publishedDate: '2026-09-05',
    updatedDate: '2026-09-12',
    intro: 'RO चालू करने पर शुद्ध पानी की धार बिल्कुल पतली हो जाना या बूंद-बूंद टपकना एक आम समस्या है। इस गाइड में जानिए कि बिना महंगे पार्ट्स बदले आप खुद कैसे पहचान सकते हैं कि रुकावट कहां है।',
    tableOfContents: [
      { id: 'top-causes', title: '1. पानी की गति धीमी होने के 4 मुख्य कारण' },
      { id: 'diy-check', title: '2. 3-मिनट DIY प्रेशर चेक' },
      { id: 'booster-pump', title: '3. बूस्टर पंप और सोलेनोइड वॉल्व (SV) की जांच' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'top-causes',
        heading: 'पानी की गति धीमी होने के 4 मुख्य कारण',
        paragraphs: [
          '1. चोक प्री-फिल्टर: पाइपलाइन की गाद सबसे पहले बाहरी प्लास्टिक बाउल में जमा होती है।',
          '2. मेम्ब्रेन स्केलिंग: खारे पानी के कैल्शियम और मैग्नीशियम मेम्ब्रेन की जाली पर परत बना देते हैं।',
          '3. लो इनपुट टैप प्रेशर: यदि छत की टंकी में पानी कम है और ग्रेविटी प्रेशर कम है, तो बूस्टर पंप को पानी खींचने में परेशानी होती है।',
          '4. एयर लॉक: फिल्टर बदलने के बाद पाइप में हवा फंस जाना।'
        ]
      },
      {
        id: 'diy-check',
        heading: '3-मिनट DIY प्रेशर चेक',
        paragraphs: [
          'बाहरी बाउल से निकलने वाले पाइप को हाथ से निकालें। यदि वहां से पानी की धार बहुत तेज आ रही है लेकिन अंदर मशीन में पानी नहीं जा रहा, तो समस्या मशीन के अंदरूनी फिल्टर में है। यदि बाहर से ही पानी धीमा है तो सिर्फ ₹100 की कैंडल बदलें।'
        ]
      }
    ],
    professionalServiceNote: 'अगर वेस्ट पाइप से पानी नहीं आ रहा और मशीन चालू करने पर कोई वाइब्रेशन नहीं हो रही, तो 24V SMPS एडॉप्टर या सोलेनोइड वॉल्व जल चुका है।',
    faqs: [
      {
        question: 'क्या RO के रिजेक्ट वॉटर को किसी काम में लिया जा सकता है?',
        answer: 'हाँ! वेस्ट वॉटर को बाल्टी में भरकर बर्तन धोने, पोछा लगाने, कपड़े धोने और फ्लशिंग के लिए इस्तेमाल करें। इसे कभी पीने या इनडोर पौधों में न डालें।'
      }
    ],
    relatedToolSlug: 'tools/repair-vs-replace',
    relatedToolName: 'Repair vs Replace Calculator',
    relatedArticleSlugs: [
      'ro-filter-kitne-mahine-mein-badalna-chahiye',
      'ro-membrane-life-in-india'
    ],
    isPublished: true
  },

  // 24. RO Service कितने महीने में करनी चाहिए?
  {
    slug: 'ro-service-kitne-mahine-mein-karni-chahiye',
    title: 'RO Purifier की Service कितने दिन में करानी चाहिए? TDS & Filter Schedule',
    h1: 'RO Purifier की Service कितने दिन में करानी चाहिए? (TDS & Servicing Guide)',
    metaDescription: 'घर के RO की सर्विस कितने महीने में करानी चाहिए? जानिए टीडीएस कैलिब्रेशन, यूवी लैंप लाइफ, टैंक सैनिटाइजेशन और वार्षिक मेंटेनेंस शेड्यूल।',
    searchIntent: 'maintenance',
    directAnswer: 'RO प्यूरीफायर की बेसिक सर्विस हर 3 से 4 महीने में (प्री-फिल्टर चेंज व टैंक सैनिटाइजेशन) और फुल कंपोनेंट ओवरहॉल सर्विस साल में 1 बार (इनलाइन फिल्टर्स, यूवी लैंप और टीडीएस कंट्रोलर ट्यूनिंग) करानी चाहिए।',
    category: 'appliances',
    categoryDisplayName: 'Home Appliances',
    readTime: '3 min read',
    author: 'Asset Doctor Water Quality Lab',
    publishedDate: '2026-09-06',
    updatedDate: '2026-09-12',
    intro: 'पानी में मौजूद हानिकारक बैक्टीरिया और भारी धातुओं से सुरक्षा तभी मिलती है जब प्यूरीफायर को सही समय पर सर्विस किया जाए। बिना सर्विस 2 साल तक चलने वाले प्यूरीफायर का टैंक खुद बैक्टीरिया का घर बन सकता है।',
    tableOfContents: [
      { id: 'service-schedule', title: '1. आदर्श 4-महीने का सर्विस चक्र' },
      { id: 'tank-sanitization', title: '2. स्टोरेज टैंक की सफाई क्यों जरूरी है?' },
      { id: 'uv-lamp-life', title: '3. UV लैंप और कॉपर फिल्टर की लाइफ' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'tank-sanitization',
        heading: 'स्टोरेज टैंक की सफाई क्यों जरूरी है?',
        paragraphs: [
          'प्लास्टिक स्टोरेज टैंक के अंदर महीनों तक पानी खड़ा रहने से दीवारों पर बायोफिल्म (Biofilm) और फिसलन भरी परत जम जाती है। हर सर्विस के समय टैंक को खाली करके सिरके या फूड-ग्रेड क्लीनर से धोना चाहिए।'
        ]
      }
    ],
    faqs: [
      {
        question: 'क्या RO के लिए वार्षिक AMC लेना फायदेमंद है?',
        answer: 'हाँ, यदि आपके पानी का TDS 800 से ज्यादा है, तो कॉम्प्रिहेंसिव AMC लेना किफायती रहता है क्योंकि इसमें साल भर के फिल्टर और मेम्ब्रेन का खर्च शामिल होता है।'
      }
    ],
    relatedToolSlug: 'tools/warranty-calculator',
    relatedToolName: 'Warranty Expiry Calculator',
    relatedArticleSlugs: [
      'ro-filter-kitne-mahine-mein-badalna-chahiye',
      'ro-warranty-kaise-check-kare'
    ],
    isPublished: true
  },

  // 25. RO Membrane कितने साल चलती है?
  {
    slug: 'ro-membrane-life-in-india',
    title: 'RO Membrane कितने साल चलती है? High TDS Area Lifespan & Replacement Cost',
    h1: 'RO Membrane कितने साल चलती है? (High TDS Durability & Replacement Costs)',
    metaDescription: 'RO की मेम्ब्रेन कितने साल में बदलनी चाहिए? जानिए 500 से 2000 TDS वाले पानी में मेम्ब्रेन की लाइफ, ओरिजिनल मेम्ब्रेन की पहचान और बदलने का खर्च।',
    searchIntent: 'informational',
    directAnswer: 'सामान्य म्युनिसिपल पानी (TDS 300-500) में एक अच्छी 75/80 GPD RO मेम्ब्रेन 2 से 3 साल तक आसानी से चलती है। लेकिन बोरवेल या अत्यधिक खारे पानी (TDS 1500-2500) में इसकी लाइफ घटकर 12 से 18 महीने रह जाती है।',
    category: 'appliances',
    categoryDisplayName: 'Home Appliances',
    readTime: '4 min read',
    author: 'Asset Doctor Water Quality Lab',
    publishedDate: '2026-09-07',
    updatedDate: '2026-09-12',
    intro: 'RO मेम्ब्रेन वाटर प्यूरीफायर का सबसे महत्वपूर्ण और महंगा पार्ट है। यह पानी के दबाव पर काम करती है और 0.0001 माइक्रोन के सूक्ष्म छिद्रों से केवल शुद्ध पानी के अणुओं को निकलने देती है। जानिए इसकी सही देखभाल कैसे करें।',
    tableOfContents: [
      { id: 'lifespan-factors', title: '1. मेम्ब्रेन की लाइफ तय करने वाले 3 कारक' },
      { id: 'original-vs-fake', title: '2. असली vs नकली मेम्ब्रेन की पहचान' },
      { id: 'replacement-cost', title: '3. नया मेम्ब्रेन लगवाने का असली खर्च' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'replacement-cost',
        heading: 'नया मेम्ब्रेन लगवाने का असली खर्च',
        paragraphs: [
          'ब्रांडेड 80 GPD ओरिजिनल मेम्ब्रेन (जैसे Kent, Aquaguard, Pureit, Dow Filmtec) की वास्तविक कीमत ₹1,200 से ₹1,800 के बीच होती है।',
          'अगर कोई लोकल मैकेनिक ₹500 में मेम्ब्रेन देने का दावा करे, तो सावधान रहें—वह या तो पुरानी रीफर्बिश्ड मेम्ब्रेन है या लो-क्वालिटी चाइनीज शीट जो भारी धातुओं को नहीं छानती।'
        ]
      }
    ],
    faqs: [
      {
        question: 'मेम्ब्रेन खराब होने का सबसे पक्का संकेत क्या है?',
        answer: 'डिजिटल TDS मीटर से आउटपुट पानी नापें। यदि रॉ वाटर का टीडीएस 1000 है और प्यूरिफाइड पानी का टीडीएस 200 से ऊपर आ रहा है (यानी रिजेक्शन रेट 90% से कम हो गया है), तो मेम्ब्रेन बदलनी होगी।'
      }
    ],
    relatedToolSlug: 'tools/asset-age-calculator',
    relatedToolName: 'Asset Age Calculator',
    relatedArticleSlugs: [
      'ro-filter-kitne-mahine-mein-badalna-chahiye',
      'ro-paani-slow-kyo-karta-hai'
    ],
    isPublished: true
  },

  // 26. RO Warranty कैसे Check करें?
  {
    slug: 'ro-warranty-kaise-check-kare',
    title: 'RO Water Purifier Warranty कैसे Check करें? AMC vs Standard Warranty Rules',
    h1: 'RO Water Purifier Warranty कैसे Check करें? (Kent, Aquaguard & Pureit Rules)',
    metaDescription: 'RO वाटर प्यूरीफायर की 1 साल की वारंटी और फ्री सर्विस कैसे क्लेम करें? जानिए क्या फिल्टर्स और मेम्ब्रेन वारंटी में कवर्ड होते हैं या केवल इलेक्ट्रिकल पार्ट्स।',
    searchIntent: 'warranty',
    directAnswer: 'अधिकांश वाटर प्यूरीफायर ब्रांड्स (Kent, Eureka Forbes, Havells) 1 साल की कॉम्प्रिहेंसिव वारंटी देते हैं, लेकिन इसमें सेडिमेंट व कार्बन फिल्टर्स जैसे कंस्यूमेबल्स (Consumables) सामान्यतः कवर्ड नहीं होते। हालांकि, बूस्टर पंप, एसवी वॉल्व, एसएमपीएस और यूवी चेंबर 100% वारंटी में फ्री रिप्लेस होते हैं।',
    category: 'warranty',
    categoryDisplayName: 'Warranty & Invoices',
    readTime: '4 min read',
    author: 'Asset Doctor Consumer Rights Desk',
    publishedDate: '2026-09-08',
    updatedDate: '2026-09-12',
    intro: 'RO खरीदने के बाद पहली साल में आने वाली खराबी को ब्रांड की ऑथराइज्ड वारंटी में मुफ्त ठीक कराया जा सकता है। लेकिन वारंटी की शर्तों की पूरी जानकारी न होने पर ग्राहक अनचाहे सर्विस चार्ज दे बैठते हैं।',
    tableOfContents: [
      { id: 'what-covered', title: '1. RO वारंटी में क्या कवर्ड है और क्या नहीं?' },
      { id: 'amc-plans', title: '2. 1 साल बाद: AMC लें या ऑन-डिमांड रिपेयर?' },
      { id: 'faqs', title: '3. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'what-covered',
        heading: 'RO वारंटी में क्या कवर्ड है और क्या नहीं?',
        paragraphs: [
          '• कवर्ड (Free Replacement): 24V बूस्टर पंप, एसएमपीएस पावर एडॉप्टर, सोलेनोइड वॉल्व, ऑटो-कटऑफ फ्लोट स्विच, और यूवी बैलास्ट।',
          '• नॉट कवर्ड (Paid Consumables): बाहर का प्री-फिल्टर बाउल, इनलाइन सेडिमेंट/कार्बन कैंडल (जब तक कि पहले 6 महीने में मैन्युफैक्चरिंग डिफेक्ट न हो)।'
        ]
      }
    ],
    faqs: [
      {
        question: 'क्या 3 साल की फ्री सर्विस का मतलब सभी पार्ट्स फ्री हैं?',
        answer: 'नहीं। कुछ ब्रांड्स 1 साल वारंटी + 3 साल फ्री सर्विस (Zero Service Charge) देते हैं। इसका मतलब है कि टेक्नीशियन की विजिटिंग फीस फ्री रहेगी, लेकिन बदले जाने वाले नए फिल्टर के पैसे आपको देने होंगे।'
      }
    ],
    relatedToolSlug: 'tools/warranty-calculator',
    relatedToolName: 'Calculate Remaining Warranty Days',
    relatedArticleSlugs: [
      'ro-service-kitne-mahine-mein-karni-chahiye',
      'invoice-kho-jaye-to-warranty-kaise-claim-kare'
    ],
    isPublished: true
  }
];
