import { BlogPost } from '../blogTypes';

export const REFRIGERATOR_ARTICLES: BlogPost[] = [
  // 9. Refrigerator Cooling कम क्यों करता है?
  {
    slug: 'refrigerator-cooling-kam-kyo-karta-hai',
    title: 'Refrigerator Cooling कम क्यों करता है? Fridge Troubleshooting Guide',
    h1: 'Refrigerator Cooling कम क्यों करता है? (फ्रीजर ठंडा है पर नीचे कूलिंग नहीं)',
    metaDescription: 'फ्रिज में नीचे ठंडक नहीं हो रही या बर्फ नहीं जम रही? जानिए डिफ्रॉस्ट हीटर, थर्मोस्टेट, डोर गैसकेट और कंडेनसर कॉइल की खराबी और घरेलू समाधान।',
    searchIntent: 'problem-solving',
    directAnswer: 'डबल-डोर फ्रिज में नीचे कूलिंग न होने का सबसे आम कारण डिफ्रॉस्ट सिस्टम (हीटर या थर्मोस्टेट बाईमेटल) का फेल होना है, जिससे अंदर की एयर डक्ट में बर्फ जम जाती है और ठंडी हवा नीचे नहीं पहुंचती। सिंगल डोर में थर्मोस्टेट सेटिंग गलत होना या डोर गैसकेट का लीक होना मुख्य वजह है।',
    category: 'appliances',
    categoryDisplayName: 'Home Appliances',
    readTime: '4 min read',
    author: 'Asset Doctor Appliance Lab',
    publishedDate: '2026-09-02',
    updatedDate: '2026-09-12',
    intro: 'डबल डोर या सिंगल डोर फ्रिज में सबसे आम समस्या यह होती है कि "ऊपर फ्रीजर में तो बर्फ जम रही है, लेकिन नीचे की कैबिनेट में रखी सब्जियां और दूध ठंडा नहीं हो रहा।" अधिकांश मामलों में यह बिना कंप्रेसर बदले बहुत कम खर्च में ठीक हो जाता है।',
    tableOfContents: [
      { id: 'common-symptoms', title: '1. फ्रीजर ठंडा पर नीचे ठंडक नहीं — मुख्य कारण' },
      { id: 'door-gasket-test', title: '2. डोर रबर सील (Gasket) का ₹10 नोट टेस्ट' },
      { id: 'coil-cleaning', title: '3. कंडेनसर कॉइल की सफाई क्यों जरूरी है?' },
      { id: 'step-defrost', title: '4. 24 घंटे का फुल मैन्युअल डिफ्रॉस्ट तरीका' },
      { id: 'faqs', title: '5. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'common-symptoms',
        heading: 'फ्रीजर ठंडा पर नीचे ठंडक नहीं — मुख्य कारण',
        paragraphs: [
          'फ्रॉस्ट-फ्री डबल डोर फ्रिज में कूलिंग केवल ऊपर फ्रीजर कॉइल में पैदा होती है। एक छोटा इवैपोरेटर फैन उस ठंडी हवा को डक्ट्स के जरिए नीचे भेजता है।',
          'अगर ऑटो-डिफ्रॉस्ट टाइमर या हीटर कॉइल खराब हो जाए, तो डक्ट के अंदर बर्फ की दीवार खड़ी हो जाती है और नीचे हवा का प्रवाह 100% रुक जाता है।'
        ],
        tip: 'इस स्थिति में फ्रिज को खाली करके 24 घंटे के लिए दोनों दरवाजे खोलकर बंद रखें ताकि डक्ट की जमी बर्फ पूरी तरह पिघल जाए।'
      },
      {
        id: 'door-gasket-test',
        heading: 'डोर रबर सील (Gasket) का ₹10 नोट टेस्ट',
        paragraphs: [
          'एक ₹10 का नोट या कागज का टुकड़ा दरवाजे और फ्रिज की बॉडी के बीच रखकर दरवाजा बंद करें।',
          'अगर कागज बिना किसी जोर के आसानी से बाहर सरक जाता है, तो मैग्नेटिक सील ढीली हो चुकी है और कमरे की गर्म हवा लगातार अंदर घुसकर कूलिंग को खत्म कर रही है।'
        ]
      },
      {
        id: 'step-defrost',
        heading: '24 घंटे का फुल मैन्युअल डिफ्रॉस्ट तरीका',
        paragraphs: [
          'अगर डक्ट चोक है तो यह DIY तरीका अपनाएं:'
        ],
        practicalSteps: [
          'फ्रिज का सारा सामान बाहर निकालें और मेन प्लग हटा दें।',
          'दोनों दरवाजे पूरी तरह खोल दें और नीचे तौलिया बिछा दें।',
          'कम से कम 20-24 घंटे तक प्राकृतिक रूप से बर्फ पिघलने दें (चाकू या नुकीली चीज का इस्तेमाल कभी न करें)।',
          'सूखे कपड़े से पोंछकर दोबारा चालू करें। अगर 3 दिन बाद फिर से वही समस्या आए तो डिफ्रॉस्ट हीटर बदलवाएं।'
        ]
      }
    ],
    professionalServiceNote: 'यदि फ्रिज के पीछे कंप्रेसर बिल्कुल चालू नहीं हो रहा (हल्की गुनगुनाहट भी नहीं आ रही) या कंप्रेसर हर 2 मिनट में खट-खट की आवाज करके बंद हो रहा है, तो पीटीसी रिले (PTC Relay) या ओएलपी (Overload Protector) बदला जाएगा।',
    faqs: [
      {
        question: 'क्या फ्रिज में गैस कभी खत्म होती है?',
        answer: 'AC की तरह फ्रिज का रेफ्रिजरेंट सिस्टम भी सीलबंद होता है। जब तक कोई कॉइल घिसकर या जंग लगकर लीक न हो, 15 साल तक गैस खत्म नहीं होती।'
      }
    ],
    relatedToolSlug: 'tools/repair-vs-replace',
    relatedToolName: 'Repair vs Replace Calculator',
    relatedArticleSlugs: [
      'fridge-mein-ice-zyada-kyo-jamti-hai',
      'refrigerator-kitne-saal-chalta-hai'
    ],
    isPublished: true
  },

  // 10. Fridge में Ice ज्यादा क्यों जमती है?
  {
    slug: 'fridge-mein-ice-zyada-kyo-jamti-hai',
    title: 'Fridge में Ice ज्यादा क्यों जमती है? Defrost Timer & Gasket Issues',
    h1: 'Fridge में Ice ज्यादा क्यों जमती है? (Excessive Frost Build-up Causes)',
    metaDescription: 'फ्रिज के फ्रीजर में जरूरत से ज्यादा बर्फ का पहाड़ क्यों जम जाता है? जानिए डिफ्रॉस्ट थर्मोस्टेट, खराब डोर सील और अत्यधिक बर्फ जमने से रोकने के आसान उपाय।',
    searchIntent: 'problem-solving',
    directAnswer: 'फ्रीजर में बर्फ का पहाड़ जमने का कारण सिंगल डोर फ्रिज में थर्मोस्टेट को लगातार मैक्सिमम (7 या Winter) पर चलाना और समय पर डिफ्रॉस्ट बटन न दबाना है। डबल डोर फ्रॉस्ट-फ्री फ्रिज में इसका कारण डिफ्रॉस्ट टाइमर या हीटर का खराब होना और डोर गैसकेट से बाहर की नमी का अंदर जाना है।',
    category: 'appliances',
    categoryDisplayName: 'Home Appliances',
    readTime: '4 min read',
    author: 'Asset Doctor Appliance Lab',
    publishedDate: '2026-09-04',
    updatedDate: '2026-09-12',
    intro: 'जब फ्रीजर में बर्फ इतनी जम जाती है कि आइस ट्रे या कटोरी बाहर न निकले, तो फ्रिज की कूलिंग एफिशिएंसी 40% घट जाती है और कंप्रेसर पर अत्यधिक लोड आने लगता है। बर्फ हटाने के लिए कभी भी चाकू का इस्तेमाल न करें।',
    tableOfContents: [
      { id: 'single-vs-double', title: '1. सिंगल डोर vs डबल डोर में बर्फ जमने का अंतर' },
      { id: 'danger-sharp-objects', title: '2. कभी चाकू से बर्फ न छुड़ाएं (बड़ी चेतावनी)' },
      { id: 'defrost-thermostat', title: '3. डिफ्रॉस्ट थर्मोस्टेट और टाइमर की जांच' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'single-vs-double',
        heading: 'सिंगल डोर vs डबल डोर में बर्फ जमने का अंतर',
        paragraphs: [
          'सिंगल डोर (Direct Cool) फ्रिज में फ्रीजर के चारों तरफ बर्फ जमना स्वाभाविक है। जब बर्फ की मोटाई 6mm (आधा सेंटीमीटर) से अधिक हो जाए, तो बीच में दिया गया लाल डिफ्रॉस्ट बटन दबाना अनिवार्य होता है।',
          'डबल डोर फ्रिज में ऑटो-डिफ्रॉस्ट होता है। यदि वहां सफेद बर्फ की परत दिख रही है, तो इसका मतलब सिस्टम का ऑटो-डिफ्रॉस्ट साइकिल काम नहीं कर रहा है।'
        ]
      },
      {
        id: 'danger-sharp-objects',
        heading: 'कभी चाकू से बर्फ न छुड़ाएं (बड़ी चेतावनी)',
        paragraphs: [
          'फ्रीजर की एल्युमिनियम प्लेट बहुत पतली होती है जिसके अंदर उच्च दबाव वाली गैस बहती है। चाकू या पेचकस लगाने से प्लेट में छेद हो जाता है और पूरी गैस तुरंत उड़ जाती है।',
          'फ्रीजर प्लेट रिप्लेसमेंट और गैस चार्जिंग का खर्च ₹2,500 से ₹3,500 तक आ जाता है।'
        ],
        warning: 'जल्दी बर्फ पिघलानी हो तो हेयर ड्रायर का दूर से हल्का ब्लो दें या एक बर्तन में गुनगुना पानी भरकर फ्रीजर में रख दें।'
      }
    ],
    faqs: [
      {
        question: 'फ्रिज का थर्मोस्टेट किस नंबर पर सेट रखना चाहिए?',
        answer: 'सामान्य मौसम में 3 या 4 नंबर (Medium) पर रखें। केवल पीक समर में 5 पर करें। कभी भी लगातार 7 (Coldest) पर न चलाएं।'
      }
    ],
    relatedToolSlug: 'tools/warranty-calculator',
    relatedToolName: 'Warranty Expiry Calculator',
    relatedArticleSlugs: [
      'refrigerator-cooling-kam-kyo-karta-hai',
      'fridge-bijli-zyada-kyo-khata-hai'
    ],
    isPublished: true
  },

  // 11. Refrigerator कितने साल चलता है?
  {
    slug: 'refrigerator-kitne-saal-chalta-hai',
    title: 'Refrigerator कितने साल चलता है? Lifespan & Compressor Life Guide',
    h1: 'Refrigerator कितने साल चलता है? (Average Lifespan & Inverter Durability)',
    metaDescription: 'भारत में एक फ्रिज की औसत उम्र कितनी होती है? जानिए सिंगल डोर vs डबल डोर लाइफ, 10-साल कंप्रेसर वारंटी और कब नया फ्रिज खरीदना बेहतर है।',
    searchIntent: 'informational',
    directAnswer: 'भारत में एक अच्छी गुणवत्ता वाले रेफ्रिजरेटर की औसत उम्र 12 से 15 साल होती है। इन्वर्टर कंप्रेसर वाले फ्रिज 15+ साल तक आसानी से काम करते हैं, बशर्ते हर साल पीछे की कंडेनसर कॉइल साफ की जाए और डोर गैसकेट टाइट रहे।',
    category: 'appliances',
    categoryDisplayName: 'Home Appliances',
    readTime: '4 min read',
    author: 'Asset Doctor Valuation Lab',
    publishedDate: '2026-09-06',
    updatedDate: '2026-09-12',
    intro: 'रेफ्रिजरेटर भारतीय घरों का सबसे टिकाऊ और लगातार 24x7 चलने वाला उपकरण है। लेकिन 10 साल से पुराना फ्रिज आधुनिक 5-स्टार इन्वर्टर मॉडल की तुलना में दोगुनी बिजली खर्च करता है। जानिए कब तक चलाना समझदारी है।',
    tableOfContents: [
      { id: 'lifespan-table', title: '1. विभिन्न प्रकार के फ्रिज की औसत उम्र' },
      { id: 'compressor-durability', title: '2. इन्वर्टर कंप्रेसर की लाइफ और 10 साल वारंटी' },
      { id: 'replacement-signs', title: '3. ये 4 संकेत दिखें तो नया फ्रिज लेने का समय आ गया है' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'lifespan-table',
        heading: 'विभिन्न प्रकार के फ्रिज की औसत उम्र',
        paragraphs: [
          '• सिंगल डोर डायरेक्ट कूल: 12 से 16 साल (साधारण मैकेनिज्म होने के कारण बहुत कम खराबी)',
          '• डबल डोर फ्रॉस्ट-फ्री: 10 से 14 साल (सेंसर और टाइमर 6-8 साल में रिप्लेस हो सकते हैं)',
          '• साइड-बाय-साइड / मल्टी-डोर: 10 से 12 साल (सॉफ्टवेयर और डिस्पेंसर पार्ट्स)'
        ]
      },
      {
        id: 'replacement-signs',
        heading: 'ये 4 संकेत दिखें तो नया फ्रिज लेने का समय आ गया है',
        paragraphs: [
          '1. बॉडी में जंग (Rusting) लगना: नीचे की मेटल बॉडी गलने से इन्सुलेशन लीक होने लगता है।',
          '2. कंप्रेसर से लगातार तेज कंपन या घरघराहट की आवाज आना।',
          '3. 10 साल से ज्यादा पुराना नॉन-स्टार मॉडल होना जो हर महीने ₹800 की बिजली खा रहा हो।',
          '4. रिपेयर खर्च ₹5,000 से ऊपर पहुंचना।'
        ]
      }
    ],
    faqs: [
      {
        question: 'क्या 12 साल पुराने फ्रिज का कंप्रेसर बदलना चाहिए?',
        answer: 'नहीं। 12 साल पुरानी बॉडी का इन्सुलेशन कमजोर हो चुका होता है और इंटरनल कॉइल में जंग लग जाती है। नया कंप्रेसर लगाने पर भी बिजली की खपत अधिक ही रहेगी।'
      }
    ],
    relatedToolSlug: 'tools/asset-age-calculator',
    relatedToolName: 'Asset Age & Depreciation Calculator',
    relatedArticleSlugs: [
      'refrigerator-cooling-kam-kyo-karta-hai',
      'refrigerator-warranty-kaise-check-kare'
    ],
    isPublished: true
  },

  // 12. Refrigerator Service कब करनी चाहिए?
  {
    slug: 'refrigerator-service-kab-karni-chahiye',
    title: 'Refrigerator Service कब और कैसे करनी चाहिए? Maintenance Checklist',
    h1: 'Refrigerator Service कब और कैसे करनी चाहिए? (Annual Maintenance Checklist)',
    metaDescription: 'क्या फ्रिज की भी सर्विस करानी पड़ती है? जानिए कंडेनसर कॉइल क्लीनिंग, ड्रेन होल सफाई, गैसकेट मेंटेनेंस और साल में 1 बार जरूरी सर्विस गाइड।',
    searchIntent: 'maintenance',
    directAnswer: 'फ्रिज को AC की तरह हर 6 महीने में वेट सर्विस की जरूरत नहीं होती, लेकिन साल में 1 बार इसके पीछे की कंडेनसर कॉइल और कंप्रेसर ट्रे की धूल साफ करना, ड्रेन होल को गर्म पानी से फ्लश करना और डोर रबर सील को साफ करना आवश्यक है।',
    category: 'appliances',
    categoryDisplayName: 'Home Appliances',
    readTime: '4 min read',
    author: 'Asset Doctor Appliance Lab',
    publishedDate: '2026-09-07',
    updatedDate: '2026-09-12',
    intro: 'अधिकांश लोग सोचते हैं कि जब तक फ्रिज ठंडा कर रहा है तब तक इसे छूने की जरूरत नहीं है। लेकिन पीछे जमी धूल की वजह से कंप्रेसर को हीट बाहर फेंकने में परेशानी होती है, जिससे बिजली बिल बढ़ता है और कंप्रेसर की लाइफ घट जाती है।',
    tableOfContents: [
      { id: 'annual-checklist', title: '1. साल में 1 बार जरूरी 4 मेंटेनेंस काम' },
      { id: 'drain-hole-cleaning', title: '2. ड्रेन होल सफाई: अंदर पानी भरने से रोकें' },
      { id: 'gasket-cleaning', title: '3. डोर गैसकेट को फंगस से कैसे बचाएं' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'annual-checklist',
        heading: 'साल में 1 बार जरूरी 4 मेंटेनेंस काम',
        paragraphs: [
          '1. पीछे की जाली (Condenser Coil) पर वैक्यूम या मुलायम ब्रश चलाएं।',
          '2. कंप्रेसर के ऊपर रखी प्लास्टिक ड्रेन ट्रे में जमी गंदगी और बदबूदार पानी साफ करें।',
          '3. फ्रिज के पैरों (Leveling Legs) को हल्का सा पीछे की तरफ झुकाएं ताकि दरवाजा अपने आप बंद हो जाए।',
          '4. अंदर के शेल्फ को हल्के गुनगुने पानी और बेकिंग सोडा से धोएं।'
        ]
      }
    ],
    faqs: [
      {
        question: 'फ्रिज के अंदर पानी की ट्रे में बदबू क्यों आती है?',
        answer: 'डिफ्रॉस्ट का पानी कंप्रेसर की हीट से भाप बनता है। समय के साथ उसमें धूल और बैक्टीरिया जमा हो जाते हैं। साल में एक बार ट्रे निकालकर साबुन से धो लें।'
      }
    ],
    relatedToolSlug: 'tools/warranty-calculator',
    relatedToolName: 'Warranty Expiry Calculator',
    relatedArticleSlugs: [
      'refrigerator-cooling-kam-kyo-karta-hai',
      'fridge-smell-odor-removal-guide'
    ],
    isPublished: true
  },

  // 13. Fridge बिजली ज्यादा क्यों खाता है?
  {
    slug: 'fridge-bijli-zyada-kyo-khata-hai',
    title: 'Refrigerator बिजली ज्यादा क्यों खाता है? 5 Energy Saving Tips',
    h1: 'Refrigerator बिजली ज्यादा क्यों खाता है? (Energy Consumption & 5 Saving Tips)',
    metaDescription: 'फ्रिज 24 घंटे चलने पर कितनी बिजली लेता है? जानिए डोर बार-बार खोलने, गर्म खाना रखने और खराब थर्मोस्टेट से बिजली की अधिक खपत रोकने के 5 तरीके।',
    searchIntent: 'informational',
    directAnswer: 'फ्रिज में अधिक बिजली खपत का कारण गर्म खाना सीधे फ्रिज में रखना, ढीली डोर रबर सील जिससे ठंडी हवा लीक होती रहे, और पीछे दीवार से सटाकर रखना जिससे कंप्रेसर ठंडा न हो पाए, होता है। सही वेंटिलेशन और 3-4 सेटिंग से बिजली खपत 20% घट जाती है।',
    category: 'appliances',
    categoryDisplayName: 'Home Appliances',
    readTime: '3 min read',
    author: 'Asset Doctor Energy Lab',
    publishedDate: '2026-09-08',
    updatedDate: '2026-09-12',
    intro: 'फ्रिज साल के 365 दिन और 24 घंटे लगातार ऑन रहता है। 250 लीटर का 3-स्टार इनवर्टर फ्रिज साल भर में लगभग 180 से 220 यूनिट बिजली खाता है (महीने का ₹120-₹150)। लेकिन गलत आदतों से यह खर्च दोगुना हो सकता है।',
    tableOfContents: [
      { id: 'reasons-high-power', title: '1. बिजली बिल बढ़ाने वाली मुख्य आदतें' },
      { id: 'energy-tips', title: '2. बिजली की खपत 20% घटाने के 5 नियम' },
      { id: 'faqs', title: '3. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'energy-tips',
        heading: 'बिजली की खपत 20% घटाने के 5 नियम',
        paragraphs: [
          'इन आसान आदतों को अपनाएं:'
        ],
        practicalSteps: [
          'गर्म दूध या सब्जी को कमरे के तापमान पर ठंडा होने के बाद ही फ्रिज में रखें।',
          'फ्रिज और दीवार के बीच कम से कम 4 इंच (10 सेमी) की जगह छोड़ें ताकि हवा का बहाव बना रहे।',
          'दरवाजा बार-बार और बिना वजह लंबे समय तक खुला न छोड़ें।',
          'फ्रिज को 80% तक ही भरें; हवा के सर्कुलेशन के लिए जगह जरूर छोड़ें।',
          'सर्दियों में थर्मोस्टेट को कम (1 या 2) पर कर दें।'
        ]
      }
    ],
    faqs: [
      {
        question: 'क्या रात में फ्रिज बंद कर देने से बिजली बचेगी?',
        answer: 'बिल्कुल नहीं! रात में बंद करने पर अंदर का तापमान बढ़ जाता है। सुबह ऑन करने पर कंप्रेसर को दोबारा ठंडा करने के लिए 4 घंटे फुल लोड पर चलना पड़ता है, जिससे अधिक बिजली खर्च होती है और खाना भी खराब होता है।'
      }
    ],
    relatedToolSlug: 'tools/ac-electricity-calculator',
    relatedToolName: 'Appliance Power Cost Calculator',
    relatedArticleSlugs: [
      'refrigerator-cooling-kam-kyo-karta-hai',
      'refrigerator-service-kab-karni-chahiye'
    ],
    isPublished: true
  },

  // 14. Refrigerator Warranty कैसे Check करें?
  {
    slug: 'refrigerator-warranty-kaise-check-kare',
    title: 'Refrigerator Warranty कैसे Check करें? 10-Year Compressor Claim Rules',
    h1: 'Refrigerator Warranty कैसे Check करें? (Compressor vs Comprehensive Claim)',
    metaDescription: 'LG, Samsung, Whirlpool, Haier फ्रिज की वारंटी कैसे चेक करें? जानिए 10 साल और 20 साल इन्वर्टर कंप्रेसर वारंटी क्लेम करने की पूरी प्रक्रिया।',
    searchIntent: 'warranty',
    directAnswer: 'फ्रिज पर सामान्यतः 1 साल की फुल कॉम्प्रिहेंसिव वारंटी और इन्वर्टर कंप्रेसर पर 10 से 20 साल की वारंटी मिलती है। वारंटी इनवॉइस डेट से शुरू होती है। क्लेम करने के लिए इनवॉइस और फ्रिज के अंदर या पीछे लगा मॉडल/सीरियल नंबर बारकोड अनिवार्य होता है।',
    category: 'warranty',
    categoryDisplayName: 'Warranty & Invoices',
    readTime: '4 min read',
    author: 'Asset Doctor Consumer Rights Desk',
    publishedDate: '2026-09-09',
    updatedDate: '2026-09-12',
    intro: 'जब फ्रिज अचानक ठंडा करना बंद कर दे, तो नया कंप्रेसर लगवाने का खर्च ₹4,000 से ₹7,000 तक आ सकता है। यदि आपका फ्रिज 10 साल से कम पुराना है तो कंप्रेसर मुफ्त में बदला जा सकता है।',
    tableOfContents: [
      { id: 'warranty-coverage', title: '1. फ्रिज वारंटी में क्या कवर्ड है?' },
      { id: 'how-to-claim', title: '2. ऑथराइज्ड क्लेम कैसे दर्ज करें?' },
      { id: 'what-is-not-covered', title: '3. क्या कवर्ड नहीं होता (Hidden Charges)?' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'what-is-not-covered',
        heading: 'क्या कवर्ड नहीं होता (Hidden Charges)?',
        paragraphs: [
          '• प्लास्टिक के शेल्फ, आइस ट्रे, बॉटल रैक और ग्लास ट्रे किसी भी वारंटी में कवर्ड नहीं होते।',
          '• गैस चार्जिंग और टेक्नीशियन विजिटिंग फीस 1 साल के बाद ग्राहक को देनी होती है, केवल कंप्रेसर मेटल पार्ट फ्री मिलता है।'
        ]
      }
    ],
    faqs: [
      {
        question: 'अगर बिल खो गया है तो क्या वारंटी मिलेगी?',
        answer: 'बिल खो जाने पर फ्रिज के सीरियल नंबर बारकोड से मैन्युफैक्चरिंग डेट ट्रैक की जाती है, लेकिन इनवॉइस न होने पर कुछ कंपनियां क्लेम रिजेक्ट कर सकती हैं। बिल की डिजिटल कॉपी हमेशा रखें।'
      }
    ],
    relatedToolSlug: 'tools/warranty-calculator',
    relatedToolName: 'Calculate Remaining Warranty Days',
    relatedArticleSlugs: [
      'refrigerator-kitne-saal-chalta-hai',
      'invoice-kho-jaye-to-warranty-kaise-claim-kare'
    ],
    isPublished: true
  },

  // 15. Refrigerator से बदबू क्यों आती है?
  {
    slug: 'fridge-smell-odor-removal-guide',
    title: 'Refrigerator से बदबू क्यों आती है? दुर्गंध दूर करने के 4 आसान घरेलू उपाय',
    h1: 'Refrigerator से बदबू क्यों आती है? (How to Remove Foul Smell from Fridge)',
    metaDescription: 'फ्रिज खोलते ही सड़े हुए खाने या सीलन की बदबू आती है? जानिए बेकिंग सोडा, नींबू, एक्टिवेटेड चारकोल और ड्रेन ट्रे क्लीनिंग के 4 अचूक उपाय।',
    searchIntent: 'how-to',
    directAnswer: 'फ्रिज में बदबू का कारण सड़ती सब्जियां, प्लास्टिक की दीवारों में सोखे गए मसाले के तेल, फफूंद लगी डोर गैसकेट, या पीछे की ड्रेन पैन में जमा रुका हुआ पानी होता है। एक कटोरी में बेकिंग सोडा या ताजा नींबू काटकर रखने से बदबू 24 घंटे में खत्म हो जाती है।',
    category: 'appliances',
    categoryDisplayName: 'Home Appliances',
    readTime: '3 min read',
    author: 'Asset Doctor Appliance Lab',
    publishedDate: '2026-09-10',
    updatedDate: '2026-09-12',
    intro: 'कई बार फ्रिज की सतह साफ दिखने के बावजूद दरवाजा खोलते ही तीखी दुर्गंध आती है, जो दूध, पानी और ताजे फलों में भी समा जाती है। रासायनिक रूम फ्रेशनर के बजाय घरेलू प्राकृतिक उपायों से इसे हमेशा के लिए खत्म करें।',
    tableOfContents: [
      { id: 'causes', title: '1. बदबू के 3 छिपे हुए स्रोत' },
      { id: 'diy-remedies', title: '2. 4 आसान व असरदार घरेलू नुस्खे' },
      { id: 'faqs', title: '3. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'diy-remedies',
        heading: '4 आसान व असरदार घरेलू नुस्खे',
        paragraphs: [
          '1. बेकिंग सोडा (Baking Soda): एक छोटी खुली कटोरी में 3 चम्मच बेकिंग सोडा रखकर फ्रिज के बीच वाले शेल्फ पर रख दें। यह सभी तरह की गंध को सोख लेता है।',
          '2. नींबू और लौंग: एक नींबू को आधा काटें, उसमें 4-5 लौंग खोंसें और कोने में रख दें।',
          '3. कॉफी पाउडर: इस्तेमाल किया हुआ सूखा कॉफी पाउडर गंध सोखने का बेहतरीन नेचुरल डीओडोराइजर है।',
          '4. विनेगर वॉश: पानी में सफेद सिरका मिलाकर शेल्फ और रबर सील को पोंछें।'
        ]
      }
    ],
    faqs: [
      {
        question: 'क्या प्याज को खुले फ्रिज में रखना चाहिए?',
        answer: 'नहीं! कटा हुआ प्याज हवा से सल्फर रिलीज करता है जो पूरे फ्रिज और आइस क्यूब्स में कड़वी बदबू पैदा कर देता है। प्याज हमेशा एयरटाइट कंटेनर में रखें।'
      }
    ],
    relatedToolSlug: 'tools/warranty-calculator',
    relatedToolName: 'Warranty Expiry Calculator',
    relatedArticleSlugs: [
      'refrigerator-service-kab-karni-chahiye',
      'refrigerator-cooling-kam-kyo-karta-hai'
    ],
    isPublished: true
  }
];
