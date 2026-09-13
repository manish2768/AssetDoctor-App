import { BlogPost } from '../blogTypes';

export const GEYSER_KITCHEN_ARTICLES: BlogPost[] = [
  // 27. Geyser में पानी गर्म क्यों नहीं हो रहा?
  {
    slug: 'geyser-heating-kam-kyo-karta-hai',
    title: 'Geyser में पानी गर्म क्यों नहीं हो रहा? Heating Element & Scale Formation',
    h1: 'Geyser में पानी गर्म क्यों नहीं हो रहा? (Water Heater Troubleshooting Guide)',
    metaDescription: 'गीजर ऑन है लेकिन पानी सिर्फ गुनगुना आ रहा है या बिल्कुल गर्म नहीं हो रहा? जानिए हीटिंग एलिमेंट पर खारे पानी का स्केल, थर्मोस्टेट कटऑफ और समाधान।',
    searchIntent: 'problem-solving',
    directAnswer: 'गीजर में पानी गर्म न होने का 80% कारण खारे पानी के कारण हीटिंग एलिमेंट (2000W Element) पर सफेद कैल्शियम की मोटी पपड़ी (Scale) जमना है, जिससे हीट पानी तक नहीं पहुंच पाती, या एलिमेंट का जल जाना है। दूसरा मुख्य कारण थर्मोस्टेट का ओवरहीट कटऑफ हो जाना है।',
    category: 'appliances',
    categoryDisplayName: 'Home Appliances',
    readTime: '4 min read',
    author: 'Asset Doctor Appliance Lab',
    publishedDate: '2026-09-05',
    updatedDate: '2026-09-12',
    intro: 'सर्दियों के मौसम में सुबह-सुबह जब नल से ठंडा पानी आता है, तो दिनचर्या रुक जाती है। गीजर के खराब होने पर अक्सर लोग सोचते हैं कि पूरा टैंक बदलना पड़ेगा, जबकि ज्यादातर मामलों में सिर्फ ₹400 से ₹800 का हीटिंग एलिमेंट या थर्मोस्टेट बदलना होता है।',
    tableOfContents: [
      { id: 'top-reasons', title: '1. पानी गर्म न होने के 3 मुख्य कारण' },
      { id: 'scale-formation', title: '2. खारे पानी (Scale) से एलिमेंट कैसे खराब होता है?' },
      { id: 'thermostat-reset', title: '3. मैन्युअल रीसेट बटन (Thermal Cutout) कैसे चेक करें?' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'top-reasons',
        heading: 'पानी गर्म न होने के 3 मुख्य कारण',
        paragraphs: [
          '1. हीटिंग एलिमेंट का फटना/जलना: वोल्टेज फ्लक्चुएशन या बिना पानी के गीजर ऑन करने (Dry Heating) से कॉपर ट्यूब तुरंत चटक जाती है।',
          '2. थर्मल कटआउट ट्रिप होना: पानी अत्यधिक गर्म होने पर सेफ्टी डिवाइस सप्लाई काट देती है। गीजर के नीचे एक छोटा लाल रीसेट पिन होता है जिसे दबाकर इसे चालू किया जा सकता है।',
          '3. इनलेट पाइप का नॉन-रिटर्न वॉल्व (NRV) जाम होना।'
        ]
      }
    ],
    professionalServiceNote: 'अगर गीजर के पानी के नल में करंट महसूस हो रहा है या चालू करते ही MCB तुरंत ट्रिप हो रही है, तो गीजर का स्विच तुरंत बंद करें और इसे बिल्कुल न छुएं। यह हीटिंग एलिमेंट की कॉपर कोटिंग फटने का पक्का संकेत है।',
    faqs: [
      {
        question: 'क्या गीजर का हीटिंग एलिमेंट खुद बदला जा सकता है?',
        answer: 'गीजर 220V हाई करंट (16 Ampere) और पानी के हाई प्रेशर पर काम करता है। सुरक्षा के मद्देनजर एलिमेंट हमेशा योग्य इलेक्ट्रीशियन से ही बदलवाएं और अर्थिंग (Earthing) जरूर चेक करवाएं।'
      }
    ],
    relatedToolSlug: 'tools/repair-vs-replace',
    relatedToolName: 'Repair vs Replace Calculator',
    relatedArticleSlugs: [
      'geyser-bijli-kitni-khata-hai',
      'geyser-kitne-saal-chalta-hai'
    ],
    isPublished: true
  },

  // 28. Water Heater Geyser कितने साल चलता है?
  {
    slug: 'geyser-kitne-saal-chalta-hai',
    title: 'Water Heater Geyser कितने साल चलता है? Anode Rod Replacement Guide',
    h1: 'Water Heater Geyser कितने साल चलता है? (Tank Durability & Anode Rod Care)',
    metaDescription: 'स्टोरेज गीजर की औसत लाइफ कितनी होती है? जानिए ग्लास-लाइन्ड इनर टैंक, जंग से सुरक्षा, मैग्नीशियम एनोड रॉड और गीजर की उम्र 10+ साल बढ़ाने के टिप्स।',
    searchIntent: 'informational',
    directAnswer: 'ग्लास-लाइन्ड इनेमल कोटेड टैंक वाले अच्छी क्वालिटी के स्टोरेज गीजर की औसत उम्र 7 से 10 साल होती है। अगर हर 2 से 3 साल में इसकी मैग्नीशियम एनोड रॉड (Sacrificial Anode Rod) बदल दी जाए, तो टैंक में कभी जंग नहीं लगता और यह 12+ साल तक टिकता है।',
    category: 'appliances',
    categoryDisplayName: 'Home Appliances',
    readTime: '4 min read',
    author: 'Asset Doctor Valuation Lab',
    publishedDate: '2026-09-06',
    updatedDate: '2026-09-12',
    intro: 'गीजर के खराब होने पर सबसे खतरनाक स्थिति टैंक की लीकेज होती है। जब इनर कंटेनर में जंग लगकर छेद हो जाता है, तो पूरा गीजर कबाड़ हो जाता है क्योंकि वेल्डिंग के बाद वह हाई वॉटर प्रेशर नहीं झेल पाता। जानिए टैंक को सुरक्षित कैसे रखें।',
    tableOfContents: [
      { id: 'anode-rod-secret', title: '1. मैग्नीशियम एनोड रॉड का सीक्रेट' },
      { id: 'glassline-vs-copper', title: '2. ग्लास-लाइन्ड vs कॉपर vs स्टेनलेस स्टील टैंक' },
      { id: 'lifespan-extenders', title: '3. गीजर की लाइफ 4 साल बढ़ाने के नियम' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'anode-rod-secret',
        heading: 'मैग्नीशियम एनोड रॉड का सीक्रेट',
        paragraphs: [
          'गीजर के टैंक के अंदर एक मैग्नीशियम की रॉड लगी होती है जिसे "सैक्रिफिशियल एनोड" कहते हैं। पानी में मौजूद जंग लगाने वाले रसायन टैंक की स्टील को खाने के बजाय खुद इस रॉड को धीरे-धीरे खाते हैं।',
          'जब 2-3 साल में यह रॉड पूरी तरह घिसकर खत्म हो जाती है, तो पानी सीधे टैंक की बॉडी पर हमला करता है और 1 साल के अंदर टैंक लीक हो जाता है।'
        ],
        tip: 'हर 2 साल में सर्विस के समय ₹300-₹500 की नई एनोड रॉड लगवाएं, आपका ₹10,000 का गीजर कभी लीक नहीं होगा।'
      }
    ],
    faqs: [
      {
        question: 'क्या लीक हुए गीजर टैंक को वेल्ड करवा सकते हैं?',
        answer: 'अपार्टमेंट्स या मल्टी-स्टोरी बिल्डिंग में जहां पानी का प्रेशर 6 से 8 बार होता है, वेल्डेड टैंक फट सकता है। लीक्ड टैंक को रिपेयर कराना असुरक्षित है।'
      }
    ],
    relatedToolSlug: 'tools/asset-age-calculator',
    relatedToolName: 'Asset Age Calculator',
    relatedArticleSlugs: [
      'geyser-heating-kam-kyo-karta-hai',
      'geyser-bijli-kitni-khata-hai'
    ],
    isPublished: true
  },

  // 29. Instant vs Storage Geyser बिजली कितनी खाता है?
  {
    slug: 'geyser-bijli-kitni-khata-hai',
    title: 'Instant vs Storage Geyser बिजली कितनी खाता है? Power Consumption Comparison',
    h1: 'Instant vs Storage Geyser बिजली कितनी खाता है? (Power Bill Comparison in India)',
    metaDescription: '3kW इंस्टेंट गीजर और 15/25 लीटर स्टोरेज गीजर 1 घंटे में कितनी बिजली खर्च करते हैं? जानिए नहाने का प्रति बाल्टी खर्च और बिजली बचाने का सही तरीका।',
    searchIntent: 'comparison',
    directAnswer: '15 लीटर का 2000W (2kW) स्टोरेज गीजर पानी गर्म करने में 20 से 25 मिनट लेता है और लगभग 0.7 से 0.8 यूनिट (₹6) बिजली खर्च करता है। 3000W (3kW) इंस्टेंट गीजर 1 बाल्टी पानी में लगभग 0.4 से 0.5 यूनिट (₹3.5) लेता है। लेकिन 24 घंटे ऑन रखने पर स्टोरेज गीजर स्टैंडबाय हीट लॉस से 1.5 यूनिट रोज बर्बाद करता है।',
    category: 'appliances',
    categoryDisplayName: 'Home Appliances',
    readTime: '4 min read',
    author: 'Asset Doctor Energy Lab',
    publishedDate: '2026-09-07',
    updatedDate: '2026-09-12',
    intro: 'सर्दियों में बिजली बिल बढ़ने का दूसरा सबसे बड़ा कारण गीजर होता है। कई घरों में सुबह गीजर ऑन करके शाम तक बंद करना भूल जाते हैं, जिससे दिन भर पानी ठंडा और गर्म होता रहता है और मीटर तेजी से घूमता है।',
    tableOfContents: [
      { id: 'comparison-table', title: '1. इंस्टेंट vs स्टोरेज गीजर: पावर व खपत तुलना' },
      { id: 'standby-loss', title: '2. स्टैंडबाय हीट लॉस क्या है?' },
      { id: 'power-saving-tips', title: '3. गीजर का बिजली बिल 30% घटाने के टिप्स' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'power-saving-tips',
        heading: 'गीजर का बिजली बिल 30% घटाने के टिप्स',
        paragraphs: [
          '• नहाने से केवल 15-20 मिनट पहले गीजर ऑन करें और नहाने जाते समय स्विच बंद कर दें।',
          '• थर्मोस्टेट तापमान को 60°C या 70°C पर रखने के बजाय 50°C पर सेट करें। इससे पानी पर्याप्त गर्म भी रहता है और स्केलिंग भी आधी हो जाती है।',
          '• बाथरूम में गर्म पानी के पाइपों पर इंसुलेशन फोम टेप लगवाएं ताकि पाइप में पानी ठंडा न हो।'
        ]
      }
    ],
    faqs: [
      {
        question: 'क्या 5-स्टार गीजर से बिजली की बचत होती है?',
        answer: 'हाँ, 5-स्टार स्टोरेज गीजर में हाई-डेंसिटी PUF इंसुलेशन होता है जो पानी को 8-10 घंटे तक गर्म रखता है, जिससे स्टैंडबाय हीट लॉस 50% कम हो जाता है।'
      }
    ],
    relatedToolSlug: 'tools/ac-electricity-calculator',
    relatedToolName: 'Appliance Power Cost Calculator',
    relatedArticleSlugs: [
      'geyser-heating-kam-kyo-karta-hai',
      'geyser-kitne-saal-chalta-hai'
    ],
    isPublished: true
  },

  // 30. Microwave Oven गर्म क्यों नहीं कर रहा?
  {
    slug: 'microwave-heating-nahi-kar-raha',
    title: 'Microwave Oven गर्म क्यों नहीं कर रहा? Magnetron & Diode Warning',
    h1: 'Microwave Oven गर्म क्यों नहीं कर रहा? (Turntable Turning But No Heat Fix)',
    metaDescription: 'माइक्रोवेव चल रहा है, लाइट और पंखा ऑन है लेकिन खाना गर्म नहीं हो रहा? जानिए मैग्नेट्रॉन, हाई-वोल्टेज डायोड, कैपेसिटर की खराबी और सेफ्टी नियम।',
    searchIntent: 'problem-solving',
    directAnswer: 'अगर माइक्रोवेव की टर्नटेबल घूम रही है, लाइट जल रही है और समय चल रहा है लेकिन खाना बिल्कुल ठंडा निकल रहा है, तो 90% मामलों में इसका हाई-वोल्टेज डायोड उड़ चुका है या मैग्नेट्रॉन (जो माइक्रोवेव तरंगें बनाता है) खराब हो गया है।',
    category: 'appliances',
    categoryDisplayName: 'Home Appliances',
    readTime: '4 min read',
    author: 'Asset Doctor Appliance Lab',
    publishedDate: '2026-09-08',
    updatedDate: '2026-09-12',
    intro: 'माइक्रोवेव में खाना गर्म न होना एक बहुत ही विशिष्ट तकनीकी खराबी है। अधिकांश लोग सोचते हैं कि अंदर कोई फ्यूज उड़ गया है। लेकिन माइक्रोवेव के अंदर 2000+ वोल्ट का हाई-वोल्टेज कैपेसिटर होता है, इसलिए इसे घर पर खुद खोलना जानलेवा हो सकता है।',
    tableOfContents: [
      { id: 'how-it-works', title: '1. माइक्रोवेव खाना कैसे गर्म करता है?' },
      { id: 'top-culprits', title: '2. खराबी के 3 मुख्य घटक: मैग्नेट्रॉन, डायोड, फ्यूज' },
      { id: 'safety-warning', title: '3. बहुत महत्वपूर्ण सुरक्षा चेतावनी' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'safety-warning',
        heading: 'बहुत महत्वपूर्ण सुरक्षा चेतावनी',
        paragraphs: [
          'माइक्रोवेव का हाई-वोल्टेज कैपेसिटर प्लग निकालने के कई घंटों बाद भी 2,000 वोल्ट से 4,000 वोल्ट का जानलेवा इलेक्ट्रिक शॉक स्टोर रखता है।',
          'इसे कभी भी यूट्यूब वीडियो देखकर घर पर खोलने का प्रयास न करें। इसे हमेशा ऑथराइज्ड सर्विस सेंटर से ही चेक कराएं।'
        ],
        warning: 'खराब मैग्नेट्रॉन से माइक्रोवेव रेडिएशन लीक हो सकता है यदि बॉडी सील ठीक से वापस न कसी जाए।'
      }
    ],
    faqs: [
      {
        question: 'नया मैग्नेट्रॉन लगवाने का खर्च कितना आता है?',
        answer: 'ब्रांडेड कन्वेक्शन या सोलो माइक्रोवेव में ओरिजिनल मैग्नेट्रॉन और लेबर का खर्च ₹1,500 से ₹2,500 के बीच आता है।'
      }
    ],
    relatedToolSlug: 'tools/repair-vs-replace',
    relatedToolName: 'Repair vs Replace Calculator',
    relatedArticleSlugs: [
      'kitchen-chimney-cleaning-kaise-kare',
      'refrigerator-cooling-kam-kyo-karta-hai'
    ],
    isPublished: true
  },

  // 31. Kitchen Chimney की सफाई कितने दिन में करें?
  {
    slug: 'kitchen-chimney-cleaning-kaise-kare',
    title: 'Kitchen Chimney की सफाई कितने दिन में करें? Baffle Filter vs Filterless',
    h1: 'Kitchen Chimney की सफाई कितने दिन में करें? (Baffle Filter Cleaning & Oil Collector)',
    metaDescription: 'किचन चिमनी का बैफल फिल्टर कितने दिन में साफ करना चाहिए? जानिए भारतीय तड़का-मसाला कुकिंग में चिमनी सक्शन ड्रॉप, आग का खतरा और डीप क्लीनिंग गाइड।',
    searchIntent: 'how-to',
    directAnswer: 'भारतीय घरों में तीखे तड़के और डीप फ्राइंग के कारण बैफल फिल्टर (Baffle Filter) को हर 15 से 25 दिन में गर्म पानी और कास्टिक सोडा/डिश सोप से साफ करना चाहिए। ऑइल कलेक्टर कप को हर हफ्ते खाली करें। फिल्टरलेस ऑटो-क्लीन चिमनी को हर 20 घंटे के उपयोग के बाद हीट ऑटो-क्लीन बटन दबाएं।',
    category: 'appliances',
    categoryDisplayName: 'Home Appliances',
    readTime: '3 min read',
    author: 'Asset Doctor Appliance Lab',
    publishedDate: '2026-09-09',
    updatedDate: '2026-09-12',
    intro: 'चिमनी के फिल्टर पर जमा चिपचिपा तेल और ग्रीस न सिर्फ चिमनी के सक्शन को 50% घटा देता है, बल्कि गैस चूल्हे की तेज आंच से फिल्टर में आग लगने (Grease Fire Hazard) का भी गंभीर खतरा पैदा करता है।',
    tableOfContents: [
      { id: 'cleaning-schedule', title: '1. सफाई का सही शेड्यूल' },
      { id: 'diy-baffle-cleaning', title: '2. बैफल फिल्टर की चिकनाई 10 मिनट में कैसे हटाएं?' },
      { id: 'motor-protection', title: '3. ब्लोअर मोटर को तेल से कैसे बचाएं' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'diy-baffle-cleaning',
        heading: 'बैफल फिल्टर की चिकनाई 10 मिनट में कैसे हटाएं?',
        paragraphs: [
          'स्टेनलेस स्टील बैफल फिल्टर से चिपचिपा तेल हटाने का सबसे आसान तरीका:'
        ],
        practicalSteps: [
          'एक बड़े टब में खौलता हुआ गर्म पानी भरें।',
          'उसमें 2 चम्मच बेकिंग सोडा, 1 कप सिरका या कास्टिक सोडा पाउडर डालें।',
          'फिल्टर को 15 मिनट के लिए भिगो दें। पूरा तेल और कालिख अपने आप पानी में तैरने लगेगी।',
          'पुराने टूथब्रश से हल्का रगड़ें, नल के पानी से धोएं और सुखाकर वापस लगा दें।'
        ]
      }
    ],
    faqs: [
      {
        question: 'क्या फिल्टरलेस (Filterless) चिमनी में कभी सफाई की जरूरत नहीं होती?',
        answer: 'नहीं! फिल्टरलेस चिमनी में ग्रीस सीधे ब्लोअर व्हील पर जाता है। हालांकि ऑटो-क्लीन फीचर अधिकांश तेल को पिघलाकर ट्रे में गिरा देता है, लेकिन साल में एक बार ब्लोअर की डीप केमिकल सर्विस जरूरी होती है।'
      }
    ],
    relatedToolSlug: 'tools/warranty-calculator',
    relatedToolName: 'Warranty Expiry Calculator',
    relatedArticleSlugs: [
      'microwave-heating-nahi-kar-raha',
      'ac-filter-kitne-din-mein-saaf-kare'
    ],
    isPublished: true
  }
];
