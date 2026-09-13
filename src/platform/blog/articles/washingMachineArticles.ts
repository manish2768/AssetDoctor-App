import { BlogPost } from '../blogTypes';

export const WASHING_MACHINE_ARTICLES: BlogPost[] = [
  // 16. Washing Machine Vibration क्यों करती है?
  {
    slug: 'washing-machine-vibration-kyo-karti-hai',
    title: 'Washing Machine Vibration क्यों करती है? Fix Shaking, Walking & Noise',
    h1: 'Washing Machine Vibration क्यों करती है? (Spin Cycle Shaking & Noise Fix)',
    metaDescription: 'स्पिन साइकिल में वाशिंग मशीन बहुत तेज हिलती, खड़खड़ाती या कूदती है? जानिए अनबैलेंस लोड, ट्रांसिट बोल्ट्स, शॉक एब्जॉर्बर और वाइब्रेशन ठीक करने के उपाय।',
    searchIntent: 'problem-solving',
    directAnswer: 'स्पिन साइकिल में वाशिंग मशीन के कंपन या खिसकने के शीर्ष 3 कारण हैं: 1) मशीन के पैरों (Leveling Feet) का असंतुलित होना, 2) ड्रम में कपड़ों का एक तरफ गुच्छा बन जाना (Unbalanced Load), और 3) नई फ्रंट लोड मशीन में पीछे लगे ट्रांसिट बोल्ट्स (Transit Bolts) का न हटाया जाना।',
    category: 'appliances',
    categoryDisplayName: 'Home Appliances',
    readTime: '4 min read',
    author: 'Asset Doctor Appliance Lab',
    publishedDate: '2026-09-03',
    updatedDate: '2026-09-12',
    intro: 'स्पिन साइकिल पर 800 से 1200 RPM पर घूमते समय वाशिंग मशीन का हल्का हिलना सामान्य है, लेकिन अगर मशीन अपनी जगह से खिसक कर चलने लगे, फर्श पर पटकने जैसी आवाज करे, तो यह ड्रम सस्पेंशन और मोटर को नुकसान पहुंचा सकता है।',
    tableOfContents: [
      { id: 'transit-bolts', title: '1. नई मशीन में सबसे बड़ी गलती: ट्रांसिट बोल्ट्स' },
      { id: 'leveling-feet', title: '2. 4 पैरों का स्पिरिट लेवल एडजस्टमेंट' },
      { id: 'unbalanced-load', title: '3. कपड़ों का भार (Load Balancing) कैसे सही रखें' },
      { id: 'suspension-shocks', title: '4. शॉक एब्जॉर्बर और ड्रम स्प्रिंग्स की खराबी' },
      { id: 'faqs', title: '5. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'transit-bolts',
        heading: 'नई मशीन में सबसे बड़ी गलती: ट्रांसिट बोल्ट्स',
        paragraphs: [
          'फ्रंट लोड वाशिंग मशीन की डिलीवरी के समय ड्रम को हिलने से बचाने के लिए पीछे 4 मोटे मेटल बोल्ट लगे होते हैं।',
          'यदि इंस्टॉलर ने इन्हें नहीं निकाला, तो मशीन चालू होते ही भयंकर आवाज के साथ उछलने लगेगी और ड्रम टूट सकता है।'
        ],
        warning: 'पहली बार मशीन चलाने से पहले हमेशा रियर पैनल पर 4 प्लास्टिक कैप्स चेक करें कि बोल्ट्स निकाल दिए गए हैं या नहीं।'
      },
      {
        id: 'leveling-feet',
        heading: '4 पैरों का स्पिरिट लेवल एडजस्टमेंट',
        paragraphs: [
          'फर्श पर थोड़ा भी ढलान होने पर मशीन के चारों पैर जमीन को समान रूप से नहीं छूते। एक पैर हवा में रहने पर स्पिन के दौरान मशीन हिलती है।',
          'मशीन के नीचे लगे रबर फीट को हाथ से या स्पैनर से घुमाकर तब तक एडजस्ट करें जब तक दोनों तरफ दबाने पर मशीन बिल्कुल न हिले।'
        ],
        tip: 'चिकने टाइल्स के फर्श पर एंटी-वाइब्रेशन रबर पैड्स (Anti-vibration pads) लगाने से 60% कंपन सोख लिया जाता है।'
      }
    ],
    professionalServiceNote: 'अगर खाली ड्रम को हाथ से घुमाने पर धातु घिसने या गड़गड़ाहट (Grinding noise) की आवाज आ रही है, तो ड्रम बेयरिंग और स्पाइडर आर्म घिस चुके हैं। इसे तुरंत मैकेनिक से बदलवाएं।',
    faqs: [
      {
        question: 'क्या एक भारी चादर या कंबल अकेले धोने से मशीन हिलती है?',
        answer: 'हाँ! एक भारी गीला कपड़ा स्पिन के समय ड्रम के एक ही कोने में चिपक जाता है। ड्रम बैलेंस करने के लिए साथ में 2-3 छोटे तौलिए जरूर डालें।'
      }
    ],
    relatedToolSlug: 'tools/repair-vs-replace',
    relatedToolName: 'Repair vs Replace Calculator',
    relatedArticleSlugs: [
      'washing-machine-cleaning-kaise-kare',
      'washing-machine-paani-leak-kyo-karti-hai'
    ],
    isPublished: true
  },

  // 17. Washing Machine पानी Leak क्यों करती है?
  {
    slug: 'washing-machine-paani-leak-kyo-karti-hai',
    title: 'Washing Machine पानी Leak क्यों करती है? Drain Pipe & Drum Seal Solutions',
    h1: 'Washing Machine पानी Leak क्यों करती है? (Front & Top Load Water Leakage Fix)',
    metaDescription: 'वाशिंग मशीन के नीचे से या सामने के दरवाजे से पानी बह रहा है? जानिए इनलेट होज, ड्रेन पाइप, डोर गास्केट रबर फटने और पानी लीकेज रोकने के आसान उपाय।',
    searchIntent: 'problem-solving',
    directAnswer: 'वाशिंग मशीन में पानी लीकेज का 80% कारण पीछे लगे ड्रेन पाइप का मुड़ना/फटना, इनलेट रबर वॉशर का कट जाना, या फ्रंट लोड के सामने वाले डोर डायफ्राम (रबर गैसकेट) में सिक्का/पिन फंसने से कट लगना है। पाइप कनेक्शन टाइट करके और रबर सील बदलकर इसे आसानी से ठीक किया जा सकता है।',
    category: 'appliances',
    categoryDisplayName: 'Home Appliances',
    readTime: '4 min read',
    author: 'Asset Doctor Appliance Lab',
    publishedDate: '2026-09-05',
    updatedDate: '2026-09-12',
    intro: 'धुलाई के दौरान अचानक फर्श पर पानी भर जाना किसी भी घर में परेशानी का सबब बन सकता है। इससे बिजली के तारों में करंट आने का खतरा भी रहता है। जानिए लीकेज की जगह कैसे पहचानें और उसे कैसे रोकें।',
    tableOfContents: [
      { id: 'locate-leak', title: '1. लीकेज कहां से हो रहा है: आगे, पीछे या नीचे से?' },
      { id: 'door-boot-gasket', title: '2. फ्रंट लोड डोर बूट सील की जांच' },
      { id: 'drain-filter', title: '3. ड्रेन पंप फिल्टर का ढीला होना' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'locate-leak',
        heading: 'लीकेज कहां से हो रहा है: आगे, पीछे या नीचे से?',
        paragraphs: [
          '• पीछे से लीकेज: पानी भरने वाले इनलेट होज या ड्रेन पाइप का जोड़ ढीला होना।',
          '• आगे के दरवाजे से: फ्रंट लोड की रबर गास्केट में दरार या झाग (Oversudsing) का अत्यधिक बनना।',
          '• नीचे के केंद्र से: ड्रेन पंप या इंटरनल टब होज का फटना।'
        ]
      }
    ],
    faqs: [
      {
        question: 'क्या सामान्य डिटर्जेंट से फ्रंट लोड में लीकेज हो सकता है?',
        answer: 'हाँ! हाथ से धोने वाला या टॉप लोड डिटर्जेंट बहुत अधिक झाग बनाता है। फ्रंट लोड में हमेशा "Matic Low-Sudsing" डिटर्जेंट इस्तेमाल करें ताकि झाग वेंट्स से बाहर न बहे।'
      }
    ],
    relatedToolSlug: 'tools/warranty-calculator',
    relatedToolName: 'Warranty Expiry Calculator',
    relatedArticleSlugs: [
      'washing-machine-vibration-kyo-karti-hai',
      'washing-machine-cleaning-kaise-kare'
    ],
    isPublished: true
  },

  // 18. Washing Machine Cleaning कैसे करें?
  {
    slug: 'washing-machine-cleaning-kaise-kare',
    title: 'Washing Machine Cleaning कैसे करें? Tub Clean & Descaling Guide',
    h1: 'Washing Machine Cleaning कैसे करें? (Tub Clean, Descaling & Odor Removal)',
    metaDescription: 'वाशिंग मशीन के ड्रम से बदबू आ रही है या कपड़ों पर सफेद धब्बे लग रहे हैं? जानिए टब क्लीन मोड, डीस्केलिंग पाउडर, सफेद सिरका और फिल्टर सफाई का सही तरीका।',
    searchIntent: 'how-to',
    directAnswer: 'वाशिंग मशीन के ड्रम को हर 30 से 45 दिन में एक बार डीस्केल (Descaling) करना चाहिए। इसके लिए ड्रम में 100 ग्राम डीस्केलिंग पाउडर या 2 कप सफेद सिरका डालकर मशीन को गर्म पानी (60°C) के साथ "Tub Clean" साइकिल पर खाली चलाएं। साथ ही नीचे का कॉइन ट्रैप फिल्टर भी साफ करें।',
    category: 'appliances',
    categoryDisplayName: 'Home Appliances',
    readTime: '4 min read',
    author: 'Asset Doctor Appliance Lab',
    publishedDate: '2026-09-06',
    updatedDate: '2026-09-12',
    intro: 'कठोर पानी (Hard Water), डिटर्जेंट के अवशेष और कपड़ों की मैल मिलकर वाशिंग मशीन के ड्रम के पीछे एक चिपचिपी परत बना देते हैं। इससे कपड़ों से सीलन की बदबू आने लगती है और हीटर पर स्केल जमने से बिजली ज्यादा खर्च होती है।',
    tableOfContents: [
      { id: 'why-descale', title: '1. डीस्केलिंग क्यों जरूरी है?' },
      { id: 'step-tub-clean', title: '2. टब क्लीनिंग के 4 आसान स्टेप्स' },
      { id: 'drain-filter-clean', title: '3. मैजिक लिंट और ड्रेन कॉइन फिल्टर सफाई' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'step-tub-clean',
        heading: 'टब क्लीनिंग के 4 आसान स्टेप्स',
        paragraphs: [
          'ड्रम की संपूर्ण सफाई के लिए:'
        ],
        practicalSteps: [
          'ड्रम खाली करें (कोई कपड़ा अंदर न हो)।',
          'ड्रम के अंदर 1 पैकेट अधिकृत डीस्केलिंग पाउडर (जैसे IFB/Bosch Scalego) डालें।',
          'कंट्रोल पैनल पर "Tub Clean" साइकिल चुनें। तापमान को 60°C या हॉट वॉटर पर सेट करें।',
          'साइकिल पूरी होने के बाद दरवाजे को 1 घंटे के लिए खुला छोड़ दें ताकि नमी सूख जाए।'
        ]
      }
    ],
    faqs: [
      {
        question: 'क्या डीस्केलिंग के लिए हार्पिक या तेजाब डाल सकते हैं?',
        answer: 'कभी नहीं! तेजाब या ब्लीच स्टेनलेस स्टील ड्रम और हीटिंग एलिमेंट को हमेशा के लिए संक्षारित (Corrode) कर देगा और वारंटी तुरंत रद्द हो जाएगी।'
      }
    ],
    relatedToolSlug: 'tools/warranty-calculator',
    relatedToolName: 'Warranty Expiry Calculator',
    relatedArticleSlugs: [
      'washing-machine-vibration-kyo-karti-hai',
      'washing-machine-service-kab-karni-chahiye'
    ],
    isPublished: true
  },

  // 19. Washing Machine कितने साल चलती है?
  {
    slug: 'washing-machine-kitne-saal-chalti-hai',
    title: 'Washing Machine कितने साल चलती है? Front Load vs Top Load Lifespan',
    h1: 'Washing Machine कितने साल चलती है? (Durability, Motor Life & Replacement Guide)',
    metaDescription: 'भारत में फुली ऑटोमैटिक और सेमी-ऑटोमैटिक वाशिंग मशीन कितने साल टिकती है? जानिए फ्रंट लोड vs टॉप लोड की लाइफ, मोटर वारंटी और 50% रिपेयर नियम।',
    searchIntent: 'informational',
    directAnswer: 'भारत में एक अच्छी फुली ऑटोमैटिक वाशिंग मशीन की औसत उम्र 8 से 12 साल होती है। फ्रंट लोड मशीनें मजबूत टब और मोटर की वजह से 10-12 साल तक चलती हैं, जबकि सेमी-ऑटोमैटिक मशीनें 7-10 साल चलती हैं। नियमित डीस्केलिंग से इसकी लाइफ 3-4 साल बढ़ाई जा सकती है।',
    category: 'appliances',
    categoryDisplayName: 'Home Appliances',
    readTime: '4 min read',
    author: 'Asset Doctor Valuation Lab',
    publishedDate: '2026-09-07',
    updatedDate: '2026-09-12',
    intro: 'वाशिंग मशीन घर का एक बड़ा निवेश है। भारतीय परिस्थितियों में खारा पानी (Borewell Hard Water) और लगातार वोल्टेज उतार-चढ़ाव इसकी लाइफ पर असर डालते हैं। जानिए आपकी मशीन की स्थिति कैसी है।',
    tableOfContents: [
      { id: 'comparison-table', title: '1. फ्रंट लोड vs टॉप लोड vs सेमी-ऑटोमैटिक लाइफ' },
      { id: 'hard-water-impact', title: '2. खारे पानी का हीटर और बेयरिंग पर असर' },
      { id: 'repair-vs-replace', title: '3. कब रिपेयर कराएं और कब नई खरीदें?' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'repair-vs-replace',
        heading: 'कब रिपेयर कराएं और कब नई खरीदें?',
        paragraphs: [
          'यदि आपकी मशीन 8 साल से पुरानी है और ड्रम बेयरिंग या इनवर्टर मोटर पीसीबी खराब हो गई है, जिसका खर्च ₹6,000 से ₹9,000 आ रहा है, तो नई 5-स्टार स्मार्ट इन्वर्टर मशीन लेना समझदारी है।',
          'नई मशीनें 40% कम पानी और 30% कम बिजली खर्च करती हैं।'
        ]
      }
    ],
    faqs: [
      {
        question: 'क्या 10 साल की मोटर वारंटी में लेबर चार्ज फ्री होता है?',
        answer: 'नहीं। 2 साल के बाद केवल मोटर पार्ट मुफ्त मिलता है। ड्रम खोलने की लेबर और विजिटिंग चार्ज ₹1,500 से ₹2,500 ग्राहक को देना होता है।'
      }
    ],
    relatedToolSlug: 'tools/asset-age-calculator',
    relatedToolName: 'Asset Age & Depreciation Calculator',
    relatedArticleSlugs: [
      'washing-machine-warranty-kaise-check-kare',
      'washing-machine-vibration-kyo-karti-hai'
    ],
    isPublished: true
  },

  // 20. Washing Machine Service कब करनी चाहिए?
  {
    slug: 'washing-machine-service-kab-karni-chahiye',
    title: 'Washing Machine Service कब करनी चाहिए? Semi-Automatic vs Fully Automatic',
    h1: 'Washing Machine Service कब करनी चाहिए? (Maintenance Schedule & Inspection)',
    metaDescription: 'वाशिंग मशीन की सर्विस कितने महीने में करानी चाहिए? जानिए इनलेट फिल्टर, ड्रेन पंप, बेल्ट टेंशन और ऑथराइज्ड सर्विसिंग का सही समय।',
    searchIntent: 'maintenance',
    directAnswer: 'वाशिंग मशीन का इनलेट वॉल्व फिल्टर और नीचे का ड्रेन कॉइन ट्रैप हर महीने घर पर साफ करना चाहिए। प्रोफेशनल मैकेनिक से ओवरहॉल सर्विस हर 18 से 24 महीने में करानी चाहिए ताकि इनर ड्रम की मैल निकाली जा सके और सस्पेंशन रॉड्स को ग्रीस किया जा सके।',
    category: 'appliances',
    categoryDisplayName: 'Home Appliances',
    readTime: '3 min read',
    author: 'Asset Doctor Appliance Lab',
    publishedDate: '2026-09-08',
    updatedDate: '2026-09-12',
    intro: 'वाशिंग मशीन बिना शोर किए चुपचाप चलती रहे और कपड़े हमेशा फ्रेश व खुशबूदार धुलें, इसके लिए एक सामान्य मेंटेनेंस रूटीन का पालन करना जरूरी है।',
    tableOfContents: [
      { id: 'routine-schedule', title: '1. मासिक vs वार्षिक सर्विस शेड्यूल' },
      { id: 'inlet-filter-clean', title: '2. इनलेट मेश फिल्टर की सफाई (कम पानी आने पर)' },
      { id: 'faqs', title: '3. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'inlet-filter-clean',
        heading: 'इनलेट मेश फिल्टर की सफाई (कम पानी आने पर)',
        paragraphs: [
          'यदि मशीन में पानी बहुत धीरे-धीरे भर रहा है, तो नल बंद करके पीछे के इनलेट पाइप को खोलें। पाइप के अंदर एक छोटी प्लास्टिक जाली होती है जो पाइपलाइन की रेत रोकती है। उसे टूथब्रश से साफ करके वापस लगा दें।'
        ]
      }
    ],
    faqs: [
      {
        question: 'क्या सेमी-ऑटोमैटिक मशीन में बेल्ट ढीली होती है?',
        answer: 'हाँ, 3-4 साल बाद ड्रायर या वॉश पल्सेटर की वी-बेल्ट (V-Belt) ढीली हो सकती है जिससे कपड़े ठीक से नहीं घूमते। इसे ₹200-₹300 में बदला जा सकता है।'
      }
    ],
    relatedToolSlug: 'tools/warranty-calculator',
    relatedToolName: 'Warranty Expiry Calculator',
    relatedArticleSlugs: [
      'washing-machine-cleaning-kaise-kare',
      'washing-machine-vibration-kyo-karti-hai'
    ],
    isPublished: true
  },

  // 21. Washing Machine Warranty कैसे Check करें?
  {
    slug: 'washing-machine-warranty-kaise-check-kare',
    title: 'Washing Machine Warranty कैसे Check करें? Motor vs Comprehensive Warranty',
    h1: 'Washing Machine Warranty कैसे Check करें? (Direct Drive Motor & PCB Rules)',
    metaDescription: 'LG, Samsung, Bosch, IFB वाशिंग मशीन की वारंटी कैसे चेक करें? जानिए 2 साल कॉम्प्रिहेंसिव, 10 साल मोटर वारंटी क्लेम करने की सही प्रक्रिया।',
    searchIntent: 'warranty',
    directAnswer: 'वाशिंग मशीन पर सामान्यतः 2 साल की पूरी कॉम्प्रिहेंसिव वारंटी और इन्वर्टर डायरेक्ट ड्राइव (DD) मोटर पर 10 या 12 साल की वारंटी मिलती है। वारंटी इनवॉइस डेट से गिनी जाती है। मशीन के पीछे या दरवाजे के अंदर लगे मॉडल व सीरियल नंबर से ब्रांड पोर्टल पर वारंटी तुरंत चेक की जा सकती है।',
    category: 'warranty',
    categoryDisplayName: 'Warranty & Invoices',
    readTime: '4 min read',
    author: 'Asset Doctor Consumer Rights Desk',
    publishedDate: '2026-09-09',
    updatedDate: '2026-09-12',
    intro: 'वाशिंग मशीन की मुख्य लागत उसके मोटर और इलेक्ट्रॉनिक कंट्रोल बोर्ड (PCB) में होती है। इनवॉइस संभाल कर रखने से आप हजारों रुपये के फ्री रिप्लेसमेंट के हकदार रहते हैं।',
    tableOfContents: [
      { id: 'warranty-breakup', title: '1. वारंटी का विभाजन: कॉम्प्रिहेंसिव vs मोटर' },
      { id: 'serial-number-location', title: '2. सीरियल नंबर स्टीकर कहां ढूंढें?' },
      { id: 'faqs', title: '3. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'serial-number-location',
        heading: 'सीरियल नंबर स्टीकर कहां ढूंढें?',
        paragraphs: [
          '• फ्रंट लोड: सामने का गोल दरवाजा खोलने पर रिम के अंदर या नीचे ड्रेन पंप के ढक्कन पर।',
          '• टॉप लोड: पीछे की तरफ जहां इनलेट पाइप जुड़ता है या ढक्कन के नीचे।'
        ]
      }
    ],
    faqs: [
      {
        question: 'चूहों द्वारा तार काटने (Rat Bite) पर क्या वारंटी मिलती है?',
        answer: 'नहीं! किसी भी ब्रांड में चूहे द्वारा तार काटना या बाहरी भौतिक क्षति (Physical Damage) वारंटी में कवर नहीं होती। इसके लिए मशीन के नीचे रैट मेश कवर जरूर लगवाएं।'
      }
    ],
    relatedToolSlug: 'tools/warranty-calculator',
    relatedToolName: 'Calculate Remaining Warranty Days',
    relatedArticleSlugs: [
      'washing-machine-kitne-saal-chalti-hai',
      'invoice-kho-jaye-to-warranty-kaise-claim-kare'
    ],
    isPublished: true
  }
];
