import { BlogPost } from '../blogTypes';

export const CAR_ARTICLES: BlogPost[] = [
  // 32. Car Service कितने KM पर करनी चाहिए?
  {
    slug: 'car-service-kitne-km-par-karni-chahiye',
    title: 'Car Service कितने KM पर करनी चाहिए? Petrol, Diesel & CNG Maintenance Schedule',
    h1: 'Car Service कितने KM पर करनी चाहिए? (Best Periodic Maintenance Schedule in India)',
    metaDescription: 'भारत में कार की सर्विस कितने किलोमीटर या कितने महीने में करानी चाहिए? जानिए 10,000 KM का नियम, ऑयल चेंज, एयर फिल्टर, ब्रेक पैड और प्रिवेंटिव मेंटेनेंस।',
    searchIntent: 'maintenance',
    directAnswer: 'अधिकांश पेट्रोल और डीजल कारों की मानक सर्विस हर 10,000 किलोमीटर या 1 साल (जो भी पहले आए) पर करानी चाहिए। शहर के बंपर-टू-बंपर ट्रैफिक में चलने वाली या सीएनजी (CNG) कारों को हर 8,000 से 10,000 KM पर सर्विस कराना इंजन की लंबी उम्र के लिए सबसे सुरक्षित है।',
    category: 'vehicles',
    categoryDisplayName: 'Vehicle Doctor',
    readTime: '5 min read',
    author: 'Asset Doctor Automotive Lab',
    publishedDate: '2026-09-02',
    updatedDate: '2026-09-12',
    intro: 'कार का समय पर मेंटेनेंस न केवल माइलेज को बनाए रखता है, बल्कि सड़क के बीच में अचानक ब्रेकडाउन (Engine Seizure) से भी बचाता है। भारतीय ड्राइविंग परिस्थितियों में बहुत अधिक धूल और क्लच का अत्यधिक इस्तेमाल होने के कारण निर्माता की समय-सीमा का पालन करना जरूरी है।',
    tableOfContents: [
      { id: 'standard-interval', title: '1. "जो भी पहले आए" (KM vs Time) का नियम' },
      { id: 'fuel-type-differences', title: '2. पेट्रोल vs डीजल vs CNG सर्विस में अंतर' },
      { id: 'standard-checklist', title: '3. 10,000 KM सर्विस में क्या-क्या बदलना अनिवार्य है?' },
      { id: 'major-service-milestones', title: '4. 40,000 KM और 80,000 KM की बड़ी सर्विस' },
      { id: 'faqs', title: '5. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'standard-interval',
        heading: '"जो भी पहले आए" (KM vs Time) का नियम',
        paragraphs: [
          'यदि आपकी कार साल भर में केवल 4,000 किलोमीटर ही चली है, तब भी 1 साल पूरा होने पर इंजन ऑयल बदलना अनिवार्य है। इंजन में पड़ा ऑयल हवा और नमी के संपर्क में आकर समय के साथ अपनी विस्कोसिटी (चिकनाई) खो देता है और एसिडिक हो जाता है।',
          'वहीं अगर आप 6 महीने में ही 10,000 KM चला लेते हैं, तो आपको 1 साल का इंतजार किए बिना तुरंत सर्विस करानी चाहिए।'
        ],
        tip: 'सर्विस में 1,000 KM से अधिक की देरी करने पर वारंटी अवधि में कंपनी फ्री वारंटी क्लेम रिजेक्ट कर सकती है।'
      },
      {
        id: 'standard-checklist',
        heading: '10,000 KM सर्विस में क्या-क्या बदलना अनिवार्य है?',
        paragraphs: [
          'प्रत्येक बेसिक सर्विस पर ये 4 चीजें जरूर बदलें:'
        ],
        practicalSteps: [
          '1. इंजन ऑयल (Synthetic या Semi-synthetic)',
          '2. ऑयल फिल्टर (नया फिल्टर न लगाने पर नया ऑयल तुरंत गंदा हो जाता है)',
          '3. एयर फिल्टर (धूल झटकने के बजाय बदल देना बेहतर है)',
          '4. एसी केबिन पोलन फिल्टर (कार के अंदर ताजी हवा के लिए)',
          '5. कूलेंट और ब्रेक ऑयल का लेवल टॉप-अप व लीकेज चेक'
        ]
      }
    ],
    professionalServiceNote: 'अगर इंजन ऑयल गेज पर गाढ़ा काला चिपचिपा कीचड़ (Sludge) दिख रहा है या एग्जॉस्ट से नीला/सफेद धुआं निकल रहा है, तो कार को आगे न चलाएं और तुरंत अधिकृत सर्विस सेंटर पर टो करवाएं।',
    faqs: [
      {
        question: 'क्या सर्विस सेंटर में इंजन फ्लश (Engine Flush) कराना जरूरी है?',
        answer: 'नहीं। अगर आप हर 10,000 KM पर नियमित ऑयल बदलते हैं, तो आधुनिक कारों में इंजन फ्लश की कोई आवश्यकता नहीं होती। यह अक्सर सर्विस सेंटर द्वारा बिल बढ़ाने के लिए जोड़ा जाता है।'
      }
    ],
    relatedToolSlug: 'tools/service-due-calculator',
    relatedToolName: 'Vehicle Service Due Estimator',
    relatedArticleSlugs: [
      'car-engine-oil-kab-change-kare',
      'car-battery-kitne-saal-chalti-hai',
      'car-service-history-kaise-maintain-kare'
    ],
    isPublished: true
  },

  // 33. Car Engine Oil कब बदलना चाहिए?
  {
    slug: 'car-engine-oil-kab-change-kare',
    title: 'Car Engine Oil कब बदलना चाहिए? Synthetic vs Mineral Oil Interval',
    h1: 'Car Engine Oil कब बदलना चाहिए? (Synthetic vs Mineral Oil Guide)',
    metaDescription: 'कार का इंजन ऑयल कितने किलोमीटर पर बदलें? जानिए 0W-20, 5W-30 ग्रेड, फुली सिंथेटिक vs मिनरल ऑयल की लाइफ और डिपस्टिक से ऑयल चेक करने का सही तरीका।',
    searchIntent: 'how-to',
    directAnswer: 'मिनरल इंजन ऑयल को हर 5,000 KM या 6 महीने में, सेमी-सिंथेटिक को हर 7,500 KM में, और 100% फुली सिंथेटिक इंजन ऑयल को हर 10,000 से 12,000 KM या 1 साल में बदलना चाहिए। ऑयल डिपस्टिक पर ऑयल का स्तर "Low" से नीचे जाने या रंग कोलतार जैसा काला होने पर तुरंत बदलें।',
    category: 'vehicles',
    categoryDisplayName: 'Vehicle Doctor',
    readTime: '4 min read',
    author: 'Asset Doctor Automotive Lab',
    publishedDate: '2026-09-04',
    updatedDate: '2026-09-12',
    intro: 'इंजन ऑयल कार के इंजन का खून है। यह धातु के पिस्टन और सिलिंडर के बीच घर्षण को शून्य करता है और अत्यधिक गर्मी को सोखता है। खराब ऑयल पर कार चलाने से लाखों रुपये का इंजन सीज हो सकता है।',
    tableOfContents: [
      { id: 'synthetic-vs-mineral', title: '1. सिंथेटिक vs मिनरल ऑयल: क्या अंतर है?' },
      { id: 'dipstick-check', title: '2. डिपस्टिक से ऑयल कैसे चेक करें (2 मिनट गाइड)' },
      { id: 'oil-viscosity', title: '3. सही ऑयल ग्रेड (0W-20 vs 5W-30) कैसे चुनें?' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'dipstick-check',
        heading: 'डिपस्टिक से ऑयल कैसे चेक करें (2 मिनट गाइड)',
        paragraphs: [
          'इंजन ठंडा होने पर समतल जमीन पर कार खड़ी करें:'
        ],
        practicalSteps: [
          'बोनट खोलें और पीले या नारंगी हैंडल वाली डिपस्टिक बाहर खींचें।',
          'साफ कपड़े या टिश्यू से उसे पोंछें और वापस पूरा अंदर डालें।',
          'दोबारा बाहर निकालें और ऑयल का स्तर देखें—यह "Min" और "Max" निशानों के बीच में होना चाहिए।',
          'उंगलियों के बीच ऑयल रगड़कर देखें; अगर उसमें खुरदुरापन या कंकड़ जैसे कण महसूस हों, तो ऑयल बदलें।'
        ]
      }
    ],
    faqs: [
      {
        question: 'क्या थोड़ा पुराना इंजन ऑयल टॉप-अप कर सकते हैं?',
        answer: 'हाँ, अगर ऑयल का लेवल कम हो गया है लेकिन सर्विस की तारीख अभी बाकी है, तो उसी ग्रेड का फ्रेश ऑयल डालकर लेवल पूरा कर लें। कभी भी अलग-अलग ग्रेड के ऑयल मिक्स न करें।'
      }
    ],
    relatedToolSlug: 'tools/service-due-calculator',
    relatedToolName: 'Vehicle Service Due Estimator',
    relatedArticleSlugs: [
      'car-service-kitne-km-par-karni-chahiye',
      'car-service-history-kaise-maintain-kare'
    ],
    isPublished: true
  },

  // 34. Car Battery कितने साल चलती है?
  {
    slug: 'car-battery-kitne-saal-chalti-hai',
    title: 'Car Battery कितने साल चलती है? Dead Battery Warning Signs in India',
    h1: 'Car Battery कितने साल चलती है? (Battery Lifespan & Replacement Guide)',
    metaDescription: 'कार की बैटरी कितने साल टिकती है? जानिए 3-4 साल की औसत लाइफ, सुबह सेल्फ स्टार्ट न लेने के लक्षण, अल्टरनेटर की जांच और बैटरी वारंटी रिप्लेसमेंट नियम।',
    searchIntent: 'informational',
    directAnswer: 'भारत में लेड-एसिड कार बैटरी की औसत उम्र 3 से 4 साल (लगभग 36 से 48 महीने) होती है। भीषण गर्मी, शॉर्ट ट्रिप्स (कम दूरी की ड्राइविंग) और डैशकैम/एक्सेसरीज के इस्तेमाल से बैटरी 2.5 से 3 साल में भी कमजोर हो सकती है।',
    category: 'vehicles',
    categoryDisplayName: 'Vehicle Doctor',
    readTime: '4 min read',
    author: 'Asset Doctor Automotive Lab',
    publishedDate: '2026-09-05',
    updatedDate: '2026-09-12',
    intro: 'कार में बैटरी अचानक बिना किसी चेतावनी के पूरी तरह डेड हो सकती है, जिससे आप ऑफिस या यात्रा के बीच में फंस सकते हैं। बैटरी की उम्र और खराब होने के शुरुआती संकेतों को जानकर आप समय रहते इसे बदल सकते हैं।',
    tableOfContents: [
      { id: 'lifespan-overview', title: '1. भारतीय मौसम में कार बैटरी की वास्तविक उम्र' },
      { id: 'failing-symptoms', title: '2. बैटरी खराब होने के 4 पक्के संकेत' },
      { id: 'warranty-pro-rata', title: '3. वारंटी में प्रो-राटा (Pro-rata) का गणित क्या है?' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'failing-symptoms',
        heading: 'बैटरी खराब होने के 4 पक्के संकेत',
        paragraphs: [
          '1. सुस्त क्रैंकिंग (Sluggish Crank): सुबह चाबी घुमाने पर इंजन बहुत धीमे-धीमे घूमता है और स्टार्ट होने में समय लेता है।',
          '2. हेडलाइट का मद्धम होना: आइडलिंग पर हेडलाइट धीमी होना और एक्सीलेटर दबाने पर तेज होना।',
          '3. बैटरी टर्मिनल्स पर सफेद या हरा पाउडर (Sulfation) जमना।',
          '4. क्लस्टर मीटर पर बैटरी का लाल सिंबल जलते रहना।'
        ]
      },
      {
        id: 'warranty-pro-rata',
        heading: 'वारंटी में प्रो-राटा (Pro-rata) का गणित क्या है?',
        paragraphs: [
          'यदि बैटरी पर 60 महीने की वारंटी लिखी है, तो आमतौर पर इसमें "30 महीने फ्री रिप्लेसमेंट + 30 महीने प्रो-राटा डिस्काउंट" होता है।',
          'पहले 30 महीनों में डिफेक्ट आने पर 100% नई बैटरी मुफ्त मिलती है। 30 महीने के बाद पुरानी बैटरी की उम्र के अनुपात में नई बैटरी पर डिस्काउंट दिया जाता है।'
        ]
      }
    ],
    faqs: [
      {
        question: 'क्या जंप स्टार्ट करने के बाद बैटरी तुरंत सही हो जाती है?',
        answer: 'जंप स्टार्ट केवल कार चालू करने के लिए है। बैटरी को वापस 80% चार्ज होने के लिए कार को बिना बंद किए कम से कम 30-40 मिनट तक 40+ km/h की गति पर चलाना जरूरी है।'
      }
    ],
    relatedToolSlug: 'tools/asset-age-calculator',
    relatedToolName: 'Asset Age Calculator',
    relatedArticleSlugs: [
      'car-service-kitne-km-par-karni-chahiye',
      'vehicle-warranty-kaise-check-kare'
    ],
    isPublished: true
  },

  // 35. Car AC Cooling क्यों नहीं करता?
  {
    slug: 'car-ac-cooling-nahi-kar-raha',
    title: 'Car AC Cooling क्यों नहीं करता? Cabin Filter & Gas Leak Solutions',
    h1: 'Car AC Cooling क्यों नहीं करता? (Car AC Troubleshooting & Gas Leak Fix)',
    metaDescription: 'कार का एसी ठंडी हवा नहीं दे रहा या सिर्फ पंखे जैसी हवा आ रही है? जानिए केबिन फिल्टर चोक, कंडेनसर डस्ट, कंप्रेसर क्लच और गैस लीकेज ठीक करने के उपाय।',
    searchIntent: 'problem-solving',
    directAnswer: 'कार एसी में कूलिंग न होने का 70% कारण डैशबोर्ड के पीछे लगा केबिन पोलन फिल्टर धूल से चोक होना, रेडिएटर के आगे लगी कंडेनसर जाली पर कीड़े/धूल जमना, या पत्थरों के टकराने से कंडेनसर से R134a/R1234yf गैस का लीक हो जाना है।',
    category: 'vehicles',
    categoryDisplayName: 'Vehicle Doctor',
    readTime: '4 min read',
    author: 'Asset Doctor Automotive Lab',
    publishedDate: '2026-09-06',
    updatedDate: '2026-09-12',
    intro: 'धूप में खड़ी कार का केबिन 60°C तक तप जाता है। ऐसे में अगर कार का एसी ऑन करने पर भी ठंडी हवा न आए तो सफर नरक बन जाता है। इस गाइड में जानिए कि बिना ठगे कार एसी की कूलिंग कैसे ठीक कराएं।',
    tableOfContents: [
      { id: 'top-reasons', title: '1. कार एसी कमजोर होने के 4 मुख्य कारण' },
      { id: 'cabin-filter-clean', title: '2. ₹200 का केबिन फिल्टर खुद कैसे बदलें?' },
      { id: 'condenser-wash', title: '3. कंडेनसर की पानी से धुलाई' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'cabin-filter-clean',
        heading: '₹200 का केबिन फिल्टर खुद कैसे बदलें?',
        paragraphs: [
          'ग्लव बॉक्स के ठीक पीछे एसी का फिल्टर होता है:'
        ],
        practicalSteps: [
          'ग्लव बॉक्स खोलें और दोनों किनारों से दबाकर नीचे गिराएं।',
          'अंदर प्लास्टिक का चौकोर स्लॉट दिखेगा। ढक्कन खोलकर फिल्टर बाहर निकालें।',
          'अगर फिल्टर काला पड़ चुका है, तो नया ₹200-₹300 का फिल्टर लगाएं। हवा का थ्रो तुरंत दोगुना हो जाएगा।'
        ]
      }
    ],
    faqs: [
      {
        question: 'क्या कार एसी ऑन करने से माइलेज कम होता है?',
        answer: 'हाँ, छोटी 1.0L-1.2L कारों में एसी कंप्रेसर इंजन पर लोड डालता है जिससे शहर में माइलेज 1 से 2 kmpl तक कम हो सकता है। हाईवे पर 80 km/h की स्पीड पर शीशे खोलकर चलने की तुलना में एसी ऑन रखना अधिक एयरोडायनामिक और किफायती होता है।'
      }
    ],
    relatedToolSlug: 'tools/repair-vs-replace',
    relatedToolName: 'Repair vs Replace Calculator',
    relatedArticleSlugs: [
      'car-service-kitne-km-par-karni-chahiye',
      'car-engine-oil-kab-change-kare'
    ],
    isPublished: true
  },

  // 36. Car Service History कैसे Maintain करें?
  {
    slug: 'car-service-history-kaise-maintain-kare',
    title: 'Car Service History कैसे Maintain करें? Resale Value & Warranty Proof',
    h1: 'Car Service History कैसे Maintain करें? (Resale Value & Digital Record Guide)',
    metaDescription: 'कार की सर्विस हिस्ट्री और बिल संभाल कर रखने से रीसेल वैल्यू 15-20% तक कैसे बढ़ जाती है? जानिए ऑथराइज्ड सर्विस रिकॉर्ड्स और डिजिटल कार पासपोर्ट बनाने का तरीका।',
    searchIntent: 'how-to',
    directAnswer: 'कार की पूरी सर्विस हिस्ट्री बनाए रखने के लिए हर सर्विस इनवॉइस, बदले गए पार्ट्स, ओडोमीटर रीडिंग और जॉब कार्ड को डिजिटली सुरक्षित रखें। एक पारदर्शी और सत्यापित सर्विस रिकॉर्ड पुरानी कार बेचते समय ₹30,000 से ₹60,000 अधिक रीसेल वैल्यू दिलाता है।',
    category: 'vehicles',
    categoryDisplayName: 'Vehicle Doctor',
    readTime: '4 min read',
    author: 'Asset Doctor Valuation Lab',
    publishedDate: '2026-09-07',
    updatedDate: '2026-09-12',
    intro: 'जब आप अपनी पुरानी कार बेचने निकलते हैं, तो हर खरीदार का पहला सवाल होता है—"क्या कार का पूरा सर्विस रिकॉर्ड उपलब्ध है?" अगर आपके पास सभी ऑथराइज्ड बिल हैं, तो कोई भी मीटर-टैंपरिंग या एक्सीडेंटल कार का आरोप नहीं लगा सकता।',
    tableOfContents: [
      { id: 'why-history-matters', title: '1. सर्विस हिस्ट्री से रीसेल वैल्यू क्यों बढ़ती है?' },
      { id: 'documents-to-keep', title: '2. कौन-कौन से 5 रिकॉर्ड संभाल कर रखने चाहिए?' },
      { id: 'warranty-claims', title: '3. वारंटी क्लेम में सर्विस हिस्ट्री का महत्व' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'documents-to-keep',
        heading: 'कौन-कौन से 5 रिकॉर्ड संभाल कर रखने चाहिए?',
        paragraphs: [
          '• 1. सभी 10,000 KM रूटीन सर्विस इनवॉइस (किलोमीटर रीडिंग के साथ)',
          '• 2. बैटरी और टायरों के खरीद बिल व वारंटी कार्ड',
          '• 3. इंश्योरेंस क्लेम और एक्सीडेंटल रिपेयर की रसीदें',
          '• 4. व्हील अलाइनमेंट और बैलेंसिंग स्लिप्स',
          '• 5. ओनर मैनुअल में सर्विस सेंटर की मोहर'
        ]
      }
    ],
    faqs: [
      {
        question: 'क्या सर्विस हिस्ट्री खो जाने पर कंपनी दोबारा रिकॉर्ड दे सकती है?',
        answer: 'हाँ, यदि आपने हमेशा अधिकृत डीलरशिप पर काम कराया है, तो कंपनी के नेशनल डेटाबेस में चेसिस नंबर से पूरी हिस्ट्री स्टोर रहती है।'
      }
    ],
    relatedToolSlug: 'tools/service-due-calculator',
    relatedToolName: 'Vehicle Service Due Estimator',
    relatedArticleSlugs: [
      'car-service-kitne-km-par-karni-chahiye',
      'vehicle-documents-kaun-kaun-se-rakhne-chahiye'
    ],
    isPublished: true
  },

  // 37. Car Tyre कितने KM पर Change करें?
  {
    slug: 'car-tyre-kitne-km-par-change-kare',
    title: 'Car Tyre कितने KM या साल में बदलने चाहिए? Tread Wear & Safety Limits',
    h1: 'Car Tyre कितने KM या साल में बदलने चाहिए? (Tread Depth & Age Safety Rules)',
    metaDescription: 'कार के टायर कितने किलोमीटर या कितने साल बाद एक्सपायर हो जाते हैं? जानिए 40,000 KM का नियम, 1.6mm ट्रेड डेप्थ कॉइन टेस्ट, अलाइनमेंट और टायर सेफ्टी।',
    searchIntent: 'informational',
    directAnswer: 'कार के टायरों को 40,000 से 50,000 किलोमीटर चलने पर या 5 साल पूरे होने पर (चाहे किलोमीटर कम भी हों) बदल देना चाहिए। 5 साल बाद रबर सूखकर कड़क हो जाती है (Dry Rot), जिससे हाईवे पर तेज गति में टायर फटने (Tyre Burst) का जानलेवा जोखिम रहता है।',
    category: 'vehicles',
    categoryDisplayName: 'Vehicle Doctor',
    readTime: '4 min read',
    author: 'Asset Doctor Automotive Lab',
    publishedDate: '2026-09-08',
    updatedDate: '2026-09-12',
    intro: 'कार के टायर ही जमीन और आपकी सुरक्षा के बीच एकमात्र संपर्क बिंदु हैं। घिसे हुए टायरों से गीली सड़क पर ब्रेक लगाने पर कार फिसलती है (Aquaplaning) और ब्रेकिंग दूरी 40% बढ़ जाती है।',
    tableOfContents: [
      { id: 'km-vs-age', title: '1. किलोमीटर vs उम्र: टायर कब एक्सपायर होते हैं?' },
      { id: 'coin-test', title: '2. ₹1 के सिक्के से ट्रेड डेप्थ (Grip) कैसे चेक करें?' },
      { id: 'tyre-rotation', title: '3. हर 10,000 KM पर टायर रोटेशन के फायदे' },
      { id: 'faqs', title: '4. अक्सर पूछे जाने वाले सवाल' }
    ],
    sections: [
      {
        id: 'coin-test',
        heading: '₹1 के सिक्के से ट्रेड डेप्थ (Grip) कैसे चेक करें?',
        paragraphs: [
          'टायर की गोलाई में 1.6mm की गहराई पर "Tread Wear Indicator (TWI)" बने होते हैं।'
        ],
        practicalSteps: [
          '₹1 के सिक्के को उल्टा करके टायर के ग्रूव्स (खांचों) में डालें।',
          'अगर सिक्के पर लिखा "1" पूरी तरह बाहर दिख रहा है, तो रबर 1.6mm से कम बची है। टायर तुरंत बदलें।'
        ],
        warning: 'टायर के साइडवॉल पर कोई उभार (Bulge/Cut) दिखे तो उसे 1 KM भी न चलाएं; वह कभी भी फट सकता है।'
      }
    ],
    faqs: [
      {
        question: 'टायर की निर्माण तिथि (DOT Code) कैसे देखें?',
        answer: 'टायर की साइडवॉल पर 4 अंकों का कोड होता है, जैसे "3422"। इसका मतलब है कि टायर 2022 के 34वें सप्ताह में बना था।'
      }
    ],
    relatedToolSlug: 'tools/asset-age-calculator',
    relatedToolName: 'Asset Age Calculator',
    relatedArticleSlugs: [
      'car-service-kitne-km-par-karni-chahiye',
      'car-service-history-kaise-maintain-kare'
    ],
    isPublished: true
  }
];
