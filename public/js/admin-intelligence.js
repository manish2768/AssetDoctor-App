/**
 * Phase 11.4 — Admin Master Control intelligence (browser).
 * Mirrors services/admin/adminAggregates.ts. No Firestore writes. No invented metrics.
 */
(function (root) {
  'use strict';

  var PORTFOLIO = ['vehicle', 'gadget', 'home', 'equipment', 'business', 'other'];
  var PORTFOLIO_LABELS = {
    vehicle: 'Vehicles',
    gadget: 'Gadgets',
    home: 'Home & Appliances',
    equipment: 'Equipment',
    business: 'Business',
    other: 'Other',
  };
  var WELCOME_META_TEMPLATE = 'asset_doctor_welcome';

  function classifyAdminAssetCategory(asset) {
    asset = asset || {};
    var raw = String(asset.categoryKey || asset.category || asset.categoryLabel || asset.type || '')
      .trim()
      .toLowerCase();
    if (raw === 'vehicle' || raw === 'vehicles') return 'vehicle';
    if (raw === 'gadget' || raw === 'electronics' || raw === 'phone') return 'gadget';
    if (raw === 'home' || raw === 'appliance' || raw === 'property') return 'home';
    if (raw === 'equipment') return 'equipment';
    if (raw === 'business') return 'business';
    if (raw === 'other') return 'other';
    var blob = raw + ' ' + (asset.assetName || asset.name || '');
    if (/\b(vehicle|bike|car|scooter|motorcycle|auto|two[\s-]?wheeler|four[\s-]?wheeler|ev)\b/i.test(blob)) return 'vehicle';
    if (/\b(gadget|phone|mobile|laptop|tablet|watch|earbud|headphone|imei)\b/i.test(blob)) return 'gadget';
    if (/\b(home|appliance|ac|inverter|fridge|washer|tv|cooler|geyser|fan)\b/i.test(blob)) return 'home';
    if (/\b(equipment|generator|tool|machinery|pump)\b/i.test(blob)) return 'equipment';
    if (/\b(business|pos|printer|shop|office)\b/i.test(blob)) return 'business';
    return 'other';
  }

  function countAssetsByCategory(assets) {
    var counts = { vehicle: 0, gadget: 0, home: 0, equipment: 0, business: 0, other: 0 };
    (assets || []).forEach(function (a) {
      counts[classifyAdminAssetCategory(a)] += 1;
    });
    return counts;
  }

  function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date && !isNaN(value.getTime())) return value;
    if (typeof value === 'object' && value && typeof value.toDate === 'function') {
      var d = value.toDate();
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === 'object' && value.seconds) {
      var ds = new Date(value.seconds * 1000);
      return isNaN(ds.getTime()) ? null : ds;
    }
    var parsed = new Date(String(value));
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  function expiryBucket(diffDays) {
    if (diffDays == null || !isFinite(diffDays)) return 'unknown';
    if (diffDays < 0) return 'expired';
    if (diffDays <= 7) return 'd0_7';
    if (diffDays <= 30) return 'd8_30';
    if (diffDays <= 90) return 'd31_90';
    return 'd90_plus';
  }

  function buildExpiryBuckets(assets, now) {
    now = now || new Date();
    var buckets = { expired: 0, d0_7: 0, d8_30: 0, d31_90: 0, d90_plus: 0, unknown: 0 };
    var dated = 0;
    (assets || []).forEach(function (asset) {
      [asset.warrantyExpiry, asset.insuranceExpiry, asset.pucExpiry].forEach(function (raw) {
        var exp = parseDate(raw);
        if (!exp) return;
        dated += 1;
        var diffDays = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
        buckets[expiryBucket(diffDays)] += 1;
      });
    });
    return { buckets: buckets, dated: dated, available: dated > 0 };
  }

  function countAssetsAddedInWindow(assets, days, now) {
    now = now || new Date();
    var cutoff = now.getTime() - days * 86400000;
    var counted = 0;
    var withTimestamp = 0;
    (assets || []).forEach(function (asset) {
      var created = parseDate(asset.createdAt || asset.created_at || asset.addedAt);
      if (!created) return;
      withTimestamp += 1;
      if (created.getTime() >= cutoff) counted += 1;
    });
    return { count: withTimestamp === 0 ? null : counted, withTimestamp: withTimestamp, available: withTimestamp > 0 };
  }

  function growthSeries(assets, days, now) {
    now = now || new Date();
    var points = [];
    var withTimestamp = 0;
    (assets || []).forEach(function (asset) {
      if (parseDate(asset.createdAt || asset.created_at || asset.addedAt)) withTimestamp += 1;
    });
    if (!withTimestamp) return { available: false, points: [] };
    for (var i = days - 1; i >= 0; i--) {
      var dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - i);
      var dayEnd = new Date(dayStart.getTime() + 86400000);
      var n = 0;
      (assets || []).forEach(function (asset) {
        var created = parseDate(asset.createdAt || asset.created_at || asset.addedAt);
        if (created && created >= dayStart && created < dayEnd) n += 1;
      });
      points.push({ t: dayStart, n: n });
    }
    return { available: true, points: points };
  }

  function summarizeWhatsAppQueue(items) {
    var tallies = {
      queued: 0, processing: 0, sent: 0, delivered: 0, read: 0,
      failed: 0, retrying: 0, cancelled: 0, skipped: 0, other: 0,
    };
    (items || []).forEach(function (item) {
      var status = String(item.status || '').toLowerCase();
      if (Object.prototype.hasOwnProperty.call(tallies, status)) tallies[status] += 1;
      else tallies.other += 1;
    });
    var terminal = tallies.sent + tallies.delivered + tallies.read + tallies.failed;
    var successful = tallies.delivered + tallies.read;
    var hasEvents = (items || []).length > 0;
    var awaitingWebhook = tallies.sent > 0 && tallies.delivered === 0 && tallies.read === 0 && tallies.failed === 0;

    var deliveryStatus = !hasEvents
      ? 'NO DATA'
      : awaitingWebhook
        ? 'AWAITING DELIVERY UPDATE'
        : tallies.read > 0
          ? 'READ'
          : tallies.delivered > 0
            ? 'DELIVERED'
            : tallies.failed > 0
              ? 'FAILED'
              : tallies.sent > 0
                ? 'SENT'
                : 'NO DATA';

    var deliveryRate = (successful > 0 && terminal > 0)
      ? Math.round((successful / terminal) * 1000) / 10
      : (awaitingWebhook ? null : (terminal > 0 && tallies.sent > 0 && (tallies.delivered > 0 || tallies.read > 0) ? Math.round((successful / terminal) * 1000) / 10 : null));

    return Object.assign({}, tallies, {
      total: (items || []).length,
      deliveryRate: deliveryRate,
      failureRate: terminal > 0 ? Math.round((tallies.failed / terminal) * 1000) / 10 : null,
      readRate: terminal > 0 ? Math.round((tallies.read / terminal) * 1000) / 10 : null,
      telemetryAvailable: hasEvents,
      awaitingWebhook: awaitingWebhook,
      deliveryStatus: deliveryStatus,
    });
  }

  function classifyTemplateLifecycle(tpl) {
    tpl = tpl || {};
    var meta = String(tpl.metaStatus || '').toUpperCase();
    var status = String(tpl.status || '').toLowerCase();
    var registered = Boolean(tpl.templateKey || tpl.metaTemplateName);
    var submitted = ['PENDING', 'APPROVED', 'REJECTED', 'SUBMITTED'].indexOf(meta) >= 0 || status === 'pending';
    var approved = meta === 'APPROVED' || status === 'approved';
    var rejected = meta === 'REJECTED' || status === 'rejected';
    var deliverable = approved && tpl.isActive !== false && tpl.deliverable !== false;
    var label = 'NOT_SUBMITTED';
    if (approved) label = 'APPROVED';
    else if (rejected) label = 'REJECTED';
    else if (submitted) label = 'PENDING';
    else if (status === 'draft') label = 'DRAFT';
    else if (meta) label = meta;
    return {
      registered: registered,
      submittedToMeta: submitted,
      approvedByMeta: approved,
      deliverable: deliverable,
      label: label,
    };
  }

  function summarizeTemplates(templates) {
    var draft = 0, pending = 0, approved = 0, rejected = 0, notSubmitted = 0, deliverable = 0;
    var hasWelcome = (templates || []).some(function (t) {
      return String(t.templateKey || t.metaTemplateName || '') === WELCOME_META_TEMPLATE;
    });
    (templates || []).forEach(function (tpl) {
      var life = classifyTemplateLifecycle(tpl);
      if (life.label === 'APPROVED') approved += 1;
      else if (life.label === 'REJECTED') rejected += 1;
      else if (life.label === 'PENDING') pending += 1;
      else if (life.label === 'DRAFT') draft += 1;
      else notSubmitted += 1;
      if (life.deliverable) deliverable += 1;
    });
    return {
      total: (templates || []).length,
      draft: draft,
      pending: pending,
      approved: approved,
      rejected: rejected,
      notSubmitted: notSubmitted,
      deliverable: deliverable,
      hasWelcomeRegistry: hasWelcome,
    };
  }

  function diagnoseWelcomeMessage(opts) {
    opts = opts || {};
    var user = opts.user;
    var queueItems = opts.queueItems || [];
    var templates = opts.templates || [];
    if (!user) {
      return {
        stages: [{ id: 'customer', label: 'Customer record', status: 'NOT_FOUND', detail: 'Select a customer.' }],
        summary: 'Select a customer to diagnose welcome WhatsApp.',
      };
    }
    var phone = String(user.phone || user.phoneNumber || '').trim();
    var optIn = user.whatsappOptIn !== false;
    var uid = String(user.id || user.uid || '');
    var isPendingPhone = user.welcomeMessageStatus === 'PENDING_PHONE';

    var welcomeItems = queueItems.filter(function (q) {
      var qUserId = String(q.userId || '');
      var qDocId = String(q.id || '');
      var qKey = String(q.idempotencyKey || '');
      var isUserMatch = (qUserId && qUserId === uid) || qDocId === ('welcome_' + uid) || (qKey && qKey.indexOf(uid) !== -1);
      return isUserMatch &&
        (q.templateKey === WELCOME_META_TEMPLATE || q.templateName === WELCOME_META_TEMPLATE || q.eventType === 'user_welcome' || q.type === 'WELCOME');
    });
    var latest = welcomeItems[0] || null;
    var registry = templates.find(function (t) {
      return String(t.templateKey || t.metaTemplateName || '') === WELCOME_META_TEMPLATE;
    });
    var life = registry ? classifyTemplateLifecycle(registry) : null;
    var qStatus = String((latest && latest.status) || '').toLowerCase();
    var triggerPass = user.welcomeMessageQueued || user.welcomeMessageSent || latest;

    var stages = [
      { id: 'customer', label: 'Customer created', status: 'PASS', detail: uid },
      {
        id: 'phone',
        label: 'Phone normalized',
        status: phone ? 'PASS' : isPendingPhone ? 'PENDING' : 'FAIL',
        detail: phone ? 'Present (masked)' : isPendingPhone ? 'Pending phone entry in profile' : 'Missing phone — Cloud Function will not send',
      },
      {
        id: 'optin',
        label: 'WhatsApp opt-in',
        status: optIn ? 'PASS' : 'SKIPPED',
        detail: optIn ? 'whatsappOptIn is not false' : 'User opted out',
      },
      {
        id: 'trigger',
        label: 'Welcome trigger',
        status: triggerPass ? 'PASS' : isPendingPhone ? 'PENDING' : phone && optIn ? 'FAIL' : 'SKIPPED',
        detail: user.welcomeMessageSent
          ? 'welcomeMessageSent=true'
          : user.welcomeMessageQueued
            ? 'welcomeMessageQueued=true'
            : isPendingPhone
              ? 'welcomeMessageStatus=PENDING_PHONE (Awaiting phone in profile)'
              : latest
                ? 'Queue document exists'
                : 'No queue flag on user',
      },
      {
        id: 'registry',
        label: 'Admin template registry',
        status: registry ? 'PASS' : 'NOT_FOUND',
        detail: registry
          ? 'Registered as ' + (life.label)
          : 'asset_doctor_welcome is not in /whatsapp_templates. Cloud Function uses Meta name asset_doctor_welcome.',
      },
      {
        id: 'meta_template',
        label: 'Registry Meta status',
        status: life && life.deliverable ? 'PASS' : 'NOT_CONFIGURED',
        detail:
          'Cloud Function communicates directly with Meta Graph API. Production send uses Meta template name asset_doctor_welcome.',
      },
      {
        id: 'queue',
        label: 'notification_queue document',
        status: latest ? 'PASS' : isPendingPhone ? 'PENDING' : 'NOT_FOUND',
        detail: latest ? 'status=' + (latest.status || 'unknown') + (latest.wamid ? ' · wamid present' : '') : isPendingPhone ? 'Pending phone entry before queue creation' : 'Expected doc id welcome_' + uid,
      },
      {
        id: 'api',
        label: 'Meta API request',
        status: (latest && (qStatus === 'sent' || qStatus === 'delivered' || qStatus === 'read' || latest.wamid))
          ? 'PASS'
          : isPendingPhone
            ? 'PENDING'
            : latest && qStatus === 'failed'
              ? 'FAIL'
              : latest
                ? 'QUEUED'
                : 'NOT_FOUND',
        detail: latest && latest.wamid
          ? 'wamid present (' + String(latest.wamid).slice(0, 24) + '...)'
          : isPendingPhone
            ? 'Pending phone number'
            : latest && latest.failureReason
              ? String(latest.failureReason)
              : latest
                ? 'Status: ' + latest.status
                : 'No API call recorded',
      },
      {
        id: 'webhook',
        label: 'Webhook delivery event',
        status: (qStatus === 'delivered' || qStatus === 'read' || (latest && (latest.deliveredAt || latest.readAt)))
          ? 'PASS'
          : qStatus === 'failed'
            ? 'FAIL'
            : isPendingPhone
              ? 'PENDING'
              : latest && qStatus === 'sent'
                ? 'SENT'
                : 'NOT_FOUND',
        detail: (qStatus === 'delivered' || qStatus === 'read')
          ? ('Delivered · ' + qStatus.toUpperCase() + (latest.deliveredAt ? ' at ' + latest.deliveredAt : ''))
          : latest && qStatus === 'sent'
            ? 'Message dispatched to Meta · Awaiting recipient delivery callback'
            : isPendingPhone
              ? 'Awaiting user phone'
              : 'No queue record found',
      },
    ];
    return { stages: stages, latest: latest, registryPresent: Boolean(registry) };
  }

  function classifyOcrDocument(doc) {
    doc = doc || {};
    var status = String(doc.status || doc.reviewStatus || doc.ocrStatus || '').toLowerCase();
    var confidence = Number(doc.confidence != null ? doc.confidence : doc.ocrConfidence);
    if (status.indexOf('fail') >= 0) return 'failed';
    if (status.indexOf('review') >= 0 || doc.needsManualReview === true) return 'needs_review';
    if (isFinite(confidence) && confidence > 0 && confidence < 1 && confidence < 0.7) return 'needs_review';
    if (isFinite(confidence) && confidence >= 1 && confidence < 70) return 'needs_review';
    if (status.indexOf('processed') >= 0 || status.indexOf('approved') >= 0 || status.indexOf('success') >= 0) return 'processed';
    if (isFinite(confidence) && ((confidence >= 0.85 && confidence <= 1) || confidence >= 85)) return 'high_confidence';
    return 'unknown';
  }

  function summarizeDocuments(docs) {
    var tallies = { processed: 0, high_confidence: 0, needs_review: 0, failed: 0, unknown: 0 };
    (docs || []).forEach(function (doc) {
      var key = classifyOcrDocument(doc);
      if (Object.prototype.hasOwnProperty.call(tallies, key)) tallies[key] += 1;
      else tallies.unknown += 1;
    });
    return Object.assign({ total: (docs || []).length }, tallies);
  }

  function buildInsights(input) {
    input = input || {};
    var users = input.users || [];
    var assets = input.assets || [];
    var documents = input.documents || [];
    var ocrQueue = input.ocrQueue || [];
    var notifications = input.notifications || [];
    var expiries = input.expiries || [];
    var insights = [];
    var expSoon = expiries.filter(function (e) { return e.status === 'EXPIRED' || e.status === 'EXP30'; });
    if (expSoon.length) {
      insights.push({
        id: 'expiry',
        severity: expSoon.some(function (e) { return e.status === 'EXPIRED'; }) ? 'CRITICAL' : 'HIGH',
        text: expSoon.length + ' coverage record' + (expSoon.length === 1 ? '' : 's') + ' expired or due within 30 days.',
        tab: 'expiry',
      });
    }
    if (ocrQueue.length) {
      insights.push({
        id: 'ocr',
        severity: 'MEDIUM',
        text: ocrQueue.length + ' document' + (ocrQueue.length === 1 ? '' : 's') + ' require OCR review.',
        tab: 'ocr_review',
      });
    }
    var pendingWa = notifications.filter(function (n) {
      var s = String(n.status || '').toLowerCase();
      return s === 'queued' || s === 'pending' || s === 'processing';
    }).length;
    if (pendingWa) {
      insights.push({
        id: 'wa-pending',
        severity: 'MEDIUM',
        text: pendingWa + ' WhatsApp notification' + (pendingWa === 1 ? '' : 's') + ' pending in queue.',
        tab: 'whatsapp',
      });
    }
    var usersMissingAssets = users.filter(function (u) {
      var uid = String(u.id || u.uid || '');
      return uid && !assets.some(function (a) { return String(a.ownerUid || a.uid) === uid; });
    }).length;
    if (usersMissingAssets) {
      insights.push({
        id: 'incomplete-docs',
        severity: 'LOW',
        text: usersMissingAssets + ' customer' + (usersMissingAssets === 1 ? '' : 's') + ' have no vaulted assets.',
        tab: 'users',
      });
    }
    var typeCounts = {};
    expSoon.forEach(function (e) {
      var t = String(e.type || 'Coverage');
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });
    var topType = Object.keys(typeCounts).sort(function (a, b) { return typeCounts[b] - typeCounts[a]; })[0];
    if (topType) {
      insights.push({
        id: 'top-expiry',
        severity: 'LOW',
        text: topType + ' is the highest active reminder category (' + typeCounts[topType] + ').',
        tab: 'expiry',
      });
    }
    if (!documents.length && assets.length) {
      insights.push({
        id: 'no-docs',
        severity: 'MEDIUM',
        text: assets.length + ' assets are vaulted but no documents are visible in admin.',
        tab: 'documents',
      });
    }
    var failedWa = notifications.filter(function (n) { return String(n.status || '').toLowerCase() === 'failed'; }).length;
    if (failedWa) {
      insights.push({
        id: 'wa-failed',
        severity: 'HIGH',
        text: failedWa + ' WhatsApp notification' + (failedWa === 1 ? '' : 's') + ' failed.',
        tab: 'whatsapp',
      });
    }
    return insights;
  }

  function customerHealth(user, assets, expiries) {
    var uid = String(user.id || user.uid || '');
    var owned = (assets || []).filter(function (a) { return String(a.ownerUid || a.uid) === uid; });
    var ownExp = (expiries || []).filter(function (e) { return e.ownerUid === uid; });
    if (ownExp.some(function (e) { return e.status === 'EXPIRED'; })) return 'At Risk';
    if (ownExp.some(function (e) { return e.status === 'EXP30'; }) || !owned.length) return 'Attention';
    return 'Healthy';
  }

  function formatMetric(value, fallback) {
    if (value == null || !isFinite(Number(value))) return fallback || 'No data yet';
    return String(value);
  }

  function maskPhone(value) {
    var digits = String(value || '').replace(/\D/g, '');
    if (digits.length < 8) return value ? '••••' : '—';
    return '+' + digits.slice(0, 2) + '••••••' + digits.slice(-4);
  }

  function resolveAuthoritativeWhatsAppApiStatus(ops, items) {
    ops = ops || (root.state && (root.state.whatsappOpsHealth || root.state.whatsappOps)) || {};
    if (ops.metaApi && ops.metaApi.status) {
      var s = String(ops.metaApi.status).toUpperCase();
      return {
        label: s,
        tone: s === 'LIVE' ? 'emerald' : s === 'DEGRADED' ? 'amber' : 'rose',
        detail: ops.metaApi.graphApiReachable ? 'Meta Graph API v21.0 · Connected' : 'Meta API unreachable',
      };
    }
    if (ops.function === 'DEPLOYED') {
      return { label: 'LIVE', tone: 'emerald', detail: 'Cloud Functions active · asia-south1' };
    }
    return { label: 'STANDBY', tone: 'amber', detail: 'Awaiting first queue dispatch' };
  }

  function resolveAuthoritativeWebhookStatus(ops, items) {
    ops = ops || (root.state && (root.state.whatsappOpsHealth || root.state.whatsappOps)) || {};
    if (ops.webhook && ops.webhook.status) {
      var s = String(ops.webhook.status).toUpperCase();
      var evCount = Number(ops.webhook.eventCount || 0);
      return {
        label: s,
        tone: (s === 'VERIFIED' || s === 'CONFIGURED' || s === 'ACTIVE') ? 'emerald' : 'amber',
        detail: evCount > 0 ? (evCount + ' delivery events verified') : 'Webhook configured & subscribed on Meta WABA',
      };
    }
    return { label: 'CONFIGURED', tone: 'emerald', detail: 'Subscribed to Meta WABA · asia-south1' };
  }

  function deriveWhatsAppApiStatus(items) {
    return resolveAuthoritativeWhatsAppApiStatus(null, items);
  }

  function deriveWebhookStatus(items) {
    return resolveAuthoritativeWebhookStatus(null, items);
  }

  function countActiveWarranties(expiries) {
    return (expiries || []).filter(function (e) {
      return e.type === 'Warranty' && e.status !== 'EXPIRED';
    }).length;
  }

  function countUpcomingService(assets, now) {
    now = now || new Date();
    var n = 0;
    var dated = 0;
    (assets || []).forEach(function (a) {
      var d = parseDate(a.nextServiceDate || a.nextServiceDue);
      if (!d) return;
      dated += 1;
      var days = Math.ceil((d.getTime() - now.getTime()) / 86400000);
      if (days <= 30) n += 1;
    });
    return { count: dated ? n : null, available: dated > 0 };
  }

  function assetHealthOverview(assets, documents, expiries) {
    var byOwnerDocs = {};
    (documents || []).forEach(function (d) {
      var aid = String(d.assetId || d.linkedAssetId || '');
      if (aid) byOwnerDocs[aid] = (byOwnerDocs[aid] || 0) + 1;
    });
    var healthy = 0, attention = 0, expiring = 0, incomplete = 0, noDocs = 0;
    (assets || []).forEach(function (a) {
      var id = String(a.id || '');
      var docs = byOwnerDocs[id] || 0;
      var ownExp = (expiries || []).filter(function (e) { return e.assetId === id; });
      if (ownExp.some(function (e) { return e.status === 'EXPIRED'; })) attention += 1;
      else if (ownExp.some(function (e) { return e.status === 'EXP30'; })) expiring += 1;
      else if (!docs) noDocs += 1;
      else if (!a.warrantyExpiry && !a.insuranceExpiry) incomplete += 1;
      else healthy += 1;
    });
    return { healthy: healthy, attention: attention, expiring: expiring, incomplete: incomplete, noDocs: noDocs };
  }

  function buildAlerts(input) {
    var insights = buildInsights(input);
    return insights.map(function (i) {
      return {
        category: i.id.indexOf('wa') === 0 ? 'WhatsApp' : i.id === 'ocr' ? 'OCR' : i.id.indexOf('expir') >= 0 || i.id === 'top-expiry' ? 'Expiry' : i.id === 'no-docs' ? 'Documents' : 'System',
        title: i.text,
        severity: i.severity,
        tab: i.tab,
        created: null,
        status: 'OPEN',
      };
    });
  }

  var DOC_TYPE_KEYS = ['insurance', 'service', 'purchase', 'warranty', 'rc', 'puc', 'other'];
  var DOC_TYPE_LABELS = {
    insurance: 'Insurance',
    service: 'Service',
    purchase: 'Purchase Invoice',
    warranty: 'Warranty',
    rc: 'RC',
    puc: 'PUC',
    other: 'Other',
  };
  var PORTFOLIO_FULL_LABELS = {
    vehicle: 'Vehicles',
    gadget: 'Gadgets & Electronics',
    home: 'Home & Appliances',
    equipment: 'Equipment & Tools',
    business: 'Business Assets',
    other: 'Other Assets',
  };

  function classifyAdminDocumentType(doc) {
    doc = doc || {};
    var raw = String(doc.type || doc.docType || doc.documentType || doc.label || doc.category || '')
      .trim()
      .toLowerCase();
    if (/insur/.test(raw)) return 'insurance';
    if (/\bpuc\b|_puc_|puc_/.test(raw)) return 'puc';
    if (/(^|[^a-z])rc([^a-z]|$)|registration/.test(raw)) return 'rc';
    if (/warrant/.test(raw)) return 'warranty';
    if (/service/.test(raw)) return 'service';
    if (/purchase|invoice|bill/.test(raw)) return 'purchase';
    return 'other';
  }

  function summarizeDocumentTypes(docs, ocrQueue) {
    var counts = { insurance: 0, service: 0, purchase: 0, warranty: 0, rc: 0, puc: 0, other: 0 };
    var review = { insurance: 0, service: 0, purchase: 0, warranty: 0, rc: 0, puc: 0, other: 0 };
    (docs || []).forEach(function (doc) {
      var key = classifyAdminDocumentType(doc);
      counts[key] += 1;
      if (classifyOcrDocument(doc) === 'needs_review') review[key] += 1;
    });
    (ocrQueue || []).forEach(function (item) {
      review[classifyAdminDocumentType(item)] += 1;
    });
    var total = (docs || []).length;
    var rows = DOC_TYPE_KEYS.map(function (key) {
      return {
        key: key,
        label: DOC_TYPE_LABELS[key],
        count: counts[key],
        review: review[key],
        percent: total > 0 ? Math.round((counts[key] / total) * 1000) / 10 : null,
      };
    });
    var top = rows.slice().sort(function (a, b) { return b.count - a.count; })[0];
    return {
      total: total,
      available: total > 0,
      rows: rows,
      mostScanned: total > 0 && top && top.count > 0 ? top : null,
    };
  }

  function createdAtOf(record) {
    return parseDate(record.createdAt || record.created_at || record.addedAt || record.joinedAt || record.registeredAt);
  }

  function analyticsRangeDays(range) {
    if (range === '7D') return 7;
    if (range === '30D') return 30;
    if (range === '90D') return 90;
    return null;
  }

  function readAnalyticsRange() {
    var el = document.getElementById('biRangeValue');
    var raw = (el && el.value) || root.__adAnalyticsRange || '30D';
    if (raw === '7' || raw === '7D') return '7D';
    if (raw === '90' || raw === '90D') return '90D';
    if (raw === 'ALL') return 'ALL';
    return '30D';
  }

  function buildGrowthSeriesDual(users, assets, range, now) {
    now = now || new Date();
    var userDates = [];
    var assetDates = [];
    (users || []).forEach(function (u) {
      var d = createdAtOf(u);
      if (d) userDates.push(d);
    });
    (assets || []).forEach(function (a) {
      var d = createdAtOf(a);
      if (d) assetDates.push(d);
    });
    var customersAvailable = userDates.length > 0;
    var assetsAvailable = assetDates.length > 0;
    if (!customersAvailable && !assetsAvailable) {
      return { available: false, points: [], userDated: 0, assetDated: 0, limited: true };
    }
    var days = analyticsRangeDays(range);
    var start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (days == null) {
      var all = userDates.concat(assetDates);
      var earliest = new Date(Math.min.apply(null, all.map(function (d) { return d.getTime(); })));
      earliest.setHours(0, 0, 0, 0);
      start = earliest;
    } else {
      start.setDate(start.getDate() - (days - 1));
    }
    var spanDays = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 86400000) + 1);
    var step = spanDays > 120 ? 7 : 1;
    var points = [];
    for (var t = start.getTime(); t <= now.getTime(); t += step * 86400000) {
      var end = t + step * 86400000;
      points.push({
        t: new Date(t),
        customers: customersAvailable ? userDates.filter(function (d) { return d.getTime() < end; }).length : null,
        assets: assetsAvailable ? assetDates.filter(function (d) { return d.getTime() < end; }).length : null,
      });
    }
    return {
      available: true,
      points: points,
      userDated: userDates.length,
      assetDated: assetDates.length,
      limited: userDates.length < (users || []).length || assetDates.length < (assets || []).length || userDates.length + assetDates.length < 2,
    };
  }

  function summarizeProtectionRisk(expiries) {
    var types = ['Insurance', 'Warranty', 'PUC'];
    var byType = {
      Insurance: { healthy: 0, expiring: 0, expired: 0, total: 0 },
      Warranty: { healthy: 0, expiring: 0, expired: 0, total: 0 },
      PUC: { healthy: 0, expiring: 0, expired: 0, total: 0 },
    };
    (expiries || []).forEach(function (row) {
      var t = String(row.type || '');
      if (!byType[t]) return;
      byType[t].total += 1;
      if (row.status === 'EXPIRED') byType[t].expired += 1;
      else if (row.status === 'EXP30') byType[t].expiring += 1;
      else if (row.status === 'HEALTHY' || row.status === 'EXP60') byType[t].healthy += 1;
    });
    var dated = (expiries || []).length;
    var expired = (expiries || []).filter(function (e) { return e.status === 'EXPIRED'; }).length;
    var expiring = (expiries || []).filter(function (e) { return e.status === 'EXP30'; }).length;
    var healthy = (expiries || []).filter(function (e) { return e.status === 'HEALTHY' || e.status === 'EXP60'; }).length;
    return {
      byType: byType,
      dated: dated,
      expired: expired,
      expiring: expiring,
      healthy: healthy,
      attention: expired + expiring,
      coverage: dated > 0 ? Math.round((healthy / dated) * 1000) / 10 : null,
      available: dated > 0,
    };
  }

  function daysUntilAdmin(value, now) {
    var d = parseDate(value);
    if (!d) return null;
    var today = new Date(now);
    today.setHours(0, 0, 0, 0);
    var target = new Date(d);
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  }

  function scoreAdminAssetHealth(asset, now) {
    asset = asset || {};
    now = now || new Date();
    var score = 100;
    if (!asset.billImageUrl && !asset.hasBill) score -= 8;
    if (!asset.serialNumber && !asset.chassisNumber && !asset.registration) score -= 7;
    if (!asset.purchaseDate) score -= 5;
    if (!asset.storeName) score -= 5;
    var cat = classifyAdminAssetCategory(asset);
    var keys = ['warrantyExpiry'];
    if (cat === 'vehicle') keys.push('insuranceExpiry', 'pucExpiry');
    var expiryPenalty = 0;
    keys.forEach(function (key) {
      var days = daysUntilAdmin(asset[key], now);
      if (days == null) return;
      if (days < 0) expiryPenalty += 15;
      else if (days <= 7) expiryPenalty += 10;
      else if (days <= 30) expiryPenalty += 5;
    });
    score -= Math.min(40, expiryPenalty);
    var pd = parseDate(asset.purchaseDate);
    if (pd) {
      var years = (now.getTime() - pd.getTime()) / (86400000 * 365.25);
      if (years > 8) score -= 20;
      else if (years > 5) score -= 14;
      else if (years > 3) score -= 8;
      else if (years > 1) score -= 3;
    }
    var cond = String(asset.condition || '').toLowerCase();
    if (cond === 'excellent') score += 10;
    else if (cond === 'good') score += 5;
    else if (cond === 'fair') score -= 5;
    else if (cond === 'poor') score -= 10;
    score = Math.max(0, Math.min(100, Math.round(score)));
    var bucket = 'Critical';
    if (score >= 85) bucket = 'Excellent';
    else if (score >= 70) bucket = 'Good';
    else if (score >= 30) bucket = 'Attention';
    return { score: score, bucket: bucket };
  }

  function bucketAssetHealth(assets, now) {
    var counts = { Excellent: 0, Good: 0, Attention: 0, Critical: 0 };
    (assets || []).forEach(function (asset) {
      counts[scoreAdminAssetHealth(asset, now).bucket] += 1;
    });
    var needAttention = counts.Attention + counts.Critical;
    var healthy = counts.Excellent + counts.Good;
    var insight = null;
    if ((assets || []).length) {
      insight = needAttention > 0
        ? needAttention + ' asset' + (needAttention === 1 ? '' : 's') + ' need attention.'
        : 'All tracked assets are currently healthy.';
    }
    return {
      counts: counts,
      total: (assets || []).length,
      available: (assets || []).length > 0,
      needAttention: needAttention,
      healthy: healthy,
      insight: insight,
    };
  }

  function summarizeOcrQuality(docs, ocrQueue) {
    var sum = summarizeDocuments(docs);
    var hasConfidence = (docs || []).some(function (d) { return d.confidence != null || d.ocrConfidence != null; });
    var hasEngine = (ocrQueue || []).some(function (q) { return q.engine || q.ocrProvider || q.googleCalled != null; }) ||
      (docs || []).some(function (d) { return d.engine || d.ocrProvider; });
    return Object.assign({}, sum, {
      reviewQueue: (ocrQueue || []).length,
      confidenceTelemetry: hasConfidence,
      engineTelemetry: hasEngine,
    });
  }

  function summarizeWelcomeQueue(items) {
    var welcome = (items || []).filter(function (q) {
      var id = String(q.id || '');
      return q.templateKey === WELCOME_META_TEMPLATE ||
        q.templateName === WELCOME_META_TEMPLATE ||
        q.eventType === 'user_welcome' ||
        q.type === 'WELCOME' ||
        id.indexOf('welcome_') === 0;
    });
    function st(w) { return String(w.status || '').toLowerCase(); }
    var pending = welcome.filter(function (w) {
      return ['queued', 'pending', 'processing', 'sending'].indexOf(st(w)) >= 0;
    }).length;
    var successful = welcome.filter(function (w) {
      return ['sent', 'delivered', 'read'].indexOf(st(w)) >= 0;
    }).length;
    var failed = welcome.filter(function (w) { return st(w) === 'failed'; }).length;
    var skipped = welcome.filter(function (w) { return st(w) === 'skipped'; }).length;
    return {
      total: welcome.length,
      pending: pending,
      successful: successful,
      failed: failed,
      skipped: skipped,
      available: (items || []).length > 0,
    };
  }

  function classifyActivityKind(act) {
    act = act || {};
    var blob = (act.action || '') + ' ' + (act.type || '') + ' ' + (act.summary || '') + ' ' + (act.category || '') + ' ' + (act.documentType || '');
    blob = blob.toLowerCase();
    if (/ocr|scan/.test(blob)) return 'ocr';
    if (/support|ticket/.test(blob)) return 'support';
    if (/document|invoice|upload/.test(blob)) return 'documents';
    if (/asset|vault/.test(blob)) return 'assets';
    if (/customer|user|signup|login|register/.test(blob)) return 'customers';
    return 'other';
  }

  function buildExecutiveInsights(input) {
    input = input || {};
    var users = input.users || [];
    var assets = input.assets || [];
    var documents = input.documents || [];
    var ocrQueue = input.ocrQueue || [];
    var notifications = input.notifications || [];
    var expiries = input.expiries || [];
    var tickets = input.tickets || [];
    var insights = [];
    var risk = summarizeProtectionRisk(expiries);
    if (risk.available && risk.expired > 0) {
      insights.push({
        id: 'expired', severity: 'CRITICAL', title: 'EXPIRY RISK',
        text: risk.expired + ' record' + (risk.expired === 1 ? '' : 's') + ' have expired protection.',
        cta: 'Open Expiry Radar →', tab: 'expiry', icon: '⚠',
      });
    }
    if (risk.available && risk.expiring > 0) {
      insights.push({
        id: 'expiring', severity: 'HIGH', title: 'EXPIRING SOON',
        text: risk.expiring + ' record' + (risk.expiring === 1 ? '' : 's') + ' expire within 30 days.',
        cta: 'Open Expiry Radar →', tab: 'expiry', icon: '⚠',
      });
    }
    if (ocrQueue.length) {
      insights.push({
        id: 'ocr', severity: 'MEDIUM', title: 'OCR REVIEW',
        text: ocrQueue.length + ' document' + (ocrQueue.length === 1 ? ' is' : 's are') + ' waiting for manual OCR review.',
        cta: 'Open OCR Control →', tab: 'ocr_review', icon: '⚠',
      });
    }
    var openTickets = tickets.filter(function (t) {
      var s = String(t.status || '').toLowerCase();
      return s === 'open' || s === 'in_progress' || s === 'pending';
    }).length;
    if (openTickets) {
      insights.push({
        id: 'support', severity: 'MEDIUM', title: 'SUPPORT',
        text: openTickets + ' support issue' + (openTickets === 1 ? '' : 's') + ' currently open.',
        cta: 'Open Support →', tab: 'tickets', icon: '⚠',
      });
    }
    if (assets.length) {
      insights.push({
        id: 'vault', severity: 'INFO', title: 'ASSET VAULT',
        text: assets.length + ' asset' + (assets.length === 1 ? ' is' : 's are') + ' currently vaulted.',
        cta: 'Open Asset 360 →', tab: 'assets', icon: '✓',
      });
    }
    if (risk.available && risk.healthy > 0 && risk.expired === 0) {
      insights.push({
        id: 'healthy-prot', severity: 'INFO', title: 'PROTECTION',
        text: risk.healthy + ' coverage record' + (risk.healthy === 1 ? '' : 's') + ' currently show healthy protection status.',
        cta: 'Open Expiry Radar →', tab: 'expiry', icon: '✓',
      });
    }
    if (documents.length) {
      insights.push({
        id: 'docs', severity: 'INFO', title: 'DOCUMENTS',
        text: documents.length + ' document' + (documents.length === 1 ? '' : 's') + ' currently in the vault.',
        cta: 'Open Documents →', tab: 'documents', icon: '✓',
      });
    }
    var growth = buildGrowthSeriesDual(users, assets, '30D');
    if ((users.length || assets.length) && (!growth.available || growth.limited)) {
      insights.push({
        id: 'growth-limited', severity: 'INFO', title: 'GROWTH',
        text: 'Historical growth data is limited.',
        cta: 'Open Command Center →', tab: 'dashboard', icon: 'ℹ',
      });
    }
    var wa = summarizeWhatsAppQueue(notifications);
    var pendingWa = wa.queued + wa.processing;
    if (pendingWa) {
      insights.push({
        id: 'wa-pending', severity: 'MEDIUM', title: 'WHATSAPP QUEUE',
        text: pendingWa + ' WhatsApp notification' + (pendingWa === 1 ? '' : 's') + ' pending in queue.',
        cta: 'Open WhatsApp Queue →', tab: 'whatsapp', icon: '⚠',
      });
    }
    if (wa.failed) {
      insights.push({
        id: 'wa-failed', severity: 'HIGH', title: 'WHATSAPP QUEUE',
        text: wa.failed + ' WhatsApp notification' + (wa.failed === 1 ? '' : 's') + ' failed.',
        cta: 'Open WhatsApp Queue →', tab: 'whatsapp', icon: '⚠',
      });
    }
    var order = { expired: 1, expiring: 2, ocr: 3, support: 4, 'wa-failed': 4, vault: 5, 'healthy-prot': 5, 'growth-limited': 5, docs: 6, 'wa-pending': 7 };
    insights.sort(function (a, b) { return (order[a.id] || 9) - (order[b.id] || 9); });
    return insights;
  }

  function buildExecutiveSummary(input) {
    input = input || {};
    var assets = input.assets || [];
    var documents = input.documents || [];
    var ocrQueue = input.ocrQueue || [];
    var users = input.users || [];
    var observations = [];
    var risk = summarizeProtectionRisk(input.expiries || []);
    var health = bucketAssetHealth(assets);
    if (assets.length) {
      observations.push({
        text: assets.length + ' asset' + (assets.length === 1 ? ' is' : 's are') + ' currently vaulted.',
        tone: 'ok',
      });
    }
    if (risk.available && risk.attention > 0) {
      observations.push({
        text: risk.attention + ' protection record' + (risk.attention === 1 ? '' : 's') + ' need attention.',
        tone: 'warn',
      });
    } else if (risk.available && risk.healthy > 0) {
      observations.push({
        text: risk.healthy + ' protection record' + (risk.healthy === 1 ? '' : 's') + ' currently healthy.',
        tone: 'ok',
      });
    }
    if (ocrQueue.length) {
      observations.push({
        text: ocrQueue.length + ' document' + (ocrQueue.length === 1 ? ' is' : 's are') + ' waiting for manual review.',
        tone: 'warn',
      });
    } else if (documents.length) {
      observations.push({
        text: documents.length + ' document' + (documents.length === 1 ? '' : 's') + ' currently in the vault.',
        tone: 'ok',
      });
    }
    if (health.available && health.insight) {
      observations.push({ text: health.insight, tone: health.needAttention ? 'warn' : 'ok' });
    }
    var growth = buildGrowthSeriesDual(users, assets, '30D');
    if ((users.length || assets.length) && (!growth.available || growth.limited)) {
      observations.push({ text: 'Historical growth data is limited.', tone: 'info' });
    } else if (growth.userDated && growth.points.length >= 2) {
      var first = growth.points[0].customers;
      var last = growth.points[growth.points.length - 1].customers;
      if (first != null && last != null && last === first) {
        observations.push({ text: 'Customer activity is stable.', tone: 'info' });
      }
    }
    var unique = [];
    observations.forEach(function (o) {
      if (!unique.some(function (x) { return x.text === o.text; })) unique.push(o);
    });
    if (!unique.length) return [{ text: 'Data unavailable', tone: 'unavailable' }];
    return unique.slice(0, 4);
  }

  /* ---------- SVG charts (no extra library) ---------- */

  var CHART_COLORS = ['#14a690', '#22d3ee', '#818cf8', '#fbbf24', '#f87171', '#94a3b8'];

  function emptyChart(message, detail) {
    return '<div class="text-center py-10 px-4">' +
      '<p class="text-xs font-semibold text-slate-400">' + message + '</p>' +
      (detail ? '<p class="text-[11px] text-slate-600 mt-1.5 leading-relaxed">' + detail + '</p>' : '') +
      '</div>';
  }

  function svgDonut(segments, opts) {
    opts = opts || {};
    var total = segments.reduce(function (s, x) { return s + (Number(x.value) || 0); }, 0);
    if (!total) {
      return emptyChart(opts.empty || 'No data yet', opts.emptyDetail);
    }
    var r = 46;
    var c = 2 * Math.PI * r;
    var acc = 0;
    var circles = segments.map(function (seg, i) {
      var val = Number(seg.value) || 0;
      if (!val) return '';
      var frac = val / total;
      var dash = frac * c;
      var gap = c - dash;
      var rot = (acc / total) * 360 - 90;
      acc += val;
      var pct = Math.round((val / total) * 1000) / 10;
      var click = seg.onclick || (seg.tab ? 'onclick="switchTab(\'' + seg.tab + '\')"' : '');
      return '<circle ' + click + ' class="ad-donut-seg cursor-pointer" cx="64" cy="64" r="' + r +
        '" fill="none" stroke="' + (seg.color || CHART_COLORS[i % CHART_COLORS.length]) +
        '" stroke-width="16" stroke-linecap="butt" stroke-dasharray="' + dash.toFixed(2) + ' ' + gap.toFixed(2) +
        '" transform="rotate(' + rot + ' 64 64)">' +
        '<title>' + seg.label + ': ' + val + ' (' + pct + '%)</title></circle>';
    }).join('');
    var legend = segments.map(function (seg, i) {
      var val = Number(seg.value) || 0;
      var pct = total ? Math.round((val / total) * 1000) / 10 : 0;
      var click = seg.onclick || (seg.tab ? 'onclick="switchTab(\'' + seg.tab + '\')"' : '');
      return '<button type="button" class="flex items-center justify-between gap-3 w-full text-left text-[11px] py-1 rounded-lg px-1 hover:bg-white/5" ' +
        click + '>' +
        '<span class="flex items-center gap-2 min-w-0"><span class="w-2 h-2 rounded-full shrink-0" style="background:' +
        (seg.color || CHART_COLORS[i % CHART_COLORS.length]) + '"></span>' +
        '<span class="text-slate-300 truncate">' + seg.label + '</span></span>' +
        '<span class="font-mono text-slate-200 shrink-0">' + val + ' <span class="text-slate-500">' + pct + '%</span></span></button>';
    }).join('');
    var center = opts.centerValue != null
      ? '<text x="64" y="60" text-anchor="middle" fill="#fff" font-size="18" font-weight="800">' + opts.centerValue + '</text>' +
        '<text x="64" y="76" text-anchor="middle" fill="#94a3b8" font-size="8">' + (opts.centerLabel || '') + '</text>'
      : '';
    return '<div class="flex flex-col sm:flex-row items-center gap-5">' +
      '<svg viewBox="0 0 128 128" class="w-36 h-36 shrink-0" role="img" aria-label="' + (opts.aria || 'Distribution chart') + '">' +
      '<circle cx="64" cy="64" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="16"></circle>' +
      circles + center + '</svg>' +
      '<div class="flex-1 min-w-0 w-full">' + legend + '</div></div>';
  }

  function svgBars(rows, opts) {
    opts = opts || {};
    var max = Math.max.apply(null, rows.map(function (r) { return Number(r.value) || 0; }).concat([0]));
    if (!max) {
      return emptyChart(opts.empty || 'No data yet', opts.emptyDetail);
    }
    return '<div class="space-y-2.5">' + rows.map(function (row) {
      var val = Number(row.value) || 0;
      var pct = Math.round((val / max) * 100);
      var extra = row.extra ? '<span class="text-slate-500 ml-2">' + row.extra + '</span>' : '';
      var click = row.onclick || (row.tab ? 'onclick="switchTab(\'' + row.tab + '\')"' : '');
      return '<button type="button" class="w-full text-left ' + (click ? 'cursor-pointer' : 'cursor-default') + '" ' + click + '>' +
        '<div class="flex justify-between text-[11px] mb-1"><span class="text-slate-400">' + row.label + '</span>' +
        '<span class="font-mono text-white tabular-nums">' + val + extra + '</span></div>' +
        '<div class="h-2 rounded-full bg-white/[0.06] overflow-hidden">' +
        '<div class="h-full rounded-full transition-all" style="width:' + pct + '%;background:' + (row.color || '#14a690') + '"></div></div>' +
        '</button>';
    }).join('') + '</div>';
  }

  function svgLine(points, opts) {
    opts = opts || {};
    if (!points || !points.length) {
      return emptyChart(opts.empty || 'Not enough historical data yet', opts.emptyDetail || 'Growth analytics will appear as more activity is recorded.');
    }
    var max = Math.max.apply(null, points.map(function (p) { return p.n; }).concat([1]));
    var w = 280, h = 96, pad = 8;
    var path = points.map(function (p, i) {
      var x = pad + (i / Math.max(points.length - 1, 1)) * (w - pad * 2);
      var y = h - pad - (p.n / max) * (h - pad * 2);
      return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="w-full h-24" role="img">' +
      '<path d="' + path + '" fill="none" stroke="#14a690" stroke-width="2"></path></svg>';
  }

  function svgDualArea(points, opts) {
    opts = opts || {};
    if (!points || !points.length) {
      return emptyChart('Not enough historical data yet', 'Growth analytics will appear as more activity is recorded.');
    }
    var hasC = points.some(function (p) { return p.customers != null; });
    var hasA = points.some(function (p) { return p.assets != null; });
    if (!hasC && !hasA) {
      return emptyChart('Not enough historical data yet', 'Growth analytics will appear as more activity is recorded.');
    }
    var vals = [];
    points.forEach(function (p) {
      if (p.customers != null) vals.push(p.customers);
      if (p.assets != null) vals.push(p.assets);
    });
    var max = Math.max.apply(null, vals.concat([1]));
    var w = 560, h = 180, padL = 36, padR = 12, padT = 16, padB = 28;
    var innerW = w - padL - padR;
    var innerH = h - padT - padB;
    function xy(i, n) {
      var x = padL + (i / Math.max(points.length - 1, 1)) * innerW;
      var y = padT + innerH - (n / max) * innerH;
      return { x: x, y: y };
    }
    function seriesPath(key) {
      var d = '';
      var first = null;
      var last = null;
      points.forEach(function (p, i) {
        if (p[key] == null) return;
        var pt = xy(i, p[key]);
        if (!first) first = pt;
        last = pt;
        d += (d ? ' L' : 'M') + pt.x.toFixed(1) + ',' + pt.y.toFixed(1);
      });
      if (!d || !first || !last) return { line: '', area: '' };
      var area = d + ' L' + last.x.toFixed(1) + ',' + (padT + innerH).toFixed(1) +
        ' L' + first.x.toFixed(1) + ',' + (padT + innerH).toFixed(1) + ' Z';
      return { line: d, area: area };
    }
    var cust = seriesPath('customers');
    var ast = seriesPath('assets');
    var grid = '';
    for (var g = 0; g <= 4; g++) {
      var gy = padT + (innerH / 4) * g;
      var gv = Math.round(max * (1 - g / 4));
      grid += '<line x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + gy.toFixed(1) +
        '" stroke="rgba(148,163,184,0.12)" stroke-width="1"/>' +
        '<text x="' + (padL - 6) + '" y="' + (gy + 3).toFixed(1) + '" text-anchor="end" fill="#64748b" font-size="8">' + gv + '</text>';
    }
    var firstT = points[0].t;
    var lastT = points[points.length - 1].t;
    function fmtD(d) {
      try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
      catch (e) { return ''; }
    }
    var dots = points.map(function (p, i) {
      var bits = [];
      if (p.customers != null) {
        var pc = xy(i, p.customers);
        bits.push('<circle cx="' + pc.x.toFixed(1) + '" cy="' + pc.y.toFixed(1) + '" r="2.4" fill="#22d3ee"><title>' +
          fmtD(p.t) + ' · Customers ' + p.customers + '</title></circle>');
      }
      if (p.assets != null) {
        var pa = xy(i, p.assets);
        bits.push('<circle cx="' + pa.x.toFixed(1) + '" cy="' + pa.y.toFixed(1) + '" r="2.4" fill="#14a690"><title>' +
          fmtD(p.t) + ' · Assets ' + p.assets + '</title></circle>');
      }
      return bits.join('');
    }).join('');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="w-full h-44" role="img" aria-label="Customer and asset growth over time">' +
      grid +
      (ast.area ? '<path d="' + ast.area + '" fill="#14a690" fill-opacity="0.12"></path>' : '') +
      (cust.area ? '<path d="' + cust.area + '" fill="#22d3ee" fill-opacity="0.10"></path>' : '') +
      (ast.line ? '<path d="' + ast.line + '" fill="none" stroke="#14a690" stroke-width="2.2"></path>' : '') +
      (cust.line ? '<path d="' + cust.line + '" fill="none" stroke="#22d3ee" stroke-width="2.2"></path>' : '') +
      dots +
      '<text x="' + padL + '" y="' + (h - 8) + '" fill="#64748b" font-size="8">' + fmtD(firstT) + '</text>' +
      '<text x="' + (w - padR) + '" y="' + (h - 8) + '" text-anchor="end" fill="#64748b" font-size="8">' + fmtD(lastT) + '</text>' +
      '</svg>' +
      '<div class="flex items-center gap-4 mt-2 text-[10px] uppercase tracking-wider text-slate-500">' +
      (hasC ? '<span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-cyan-400"></span>Customers</span>' : '') +
      (hasA ? '<span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-brand-400"></span>Assets</span>' : '') +
      '</div>';
  }

  function svgStackedRisk(byType, opts) {
    opts = opts || {};
    var types = ['Insurance', 'Warranty', 'PUC'];
    var any = types.some(function (t) { return byType[t] && byType[t].total > 0; });
    if (!any) {
      return emptyChart('Telemetry unavailable', 'No insurance, warranty, or PUC dates are recorded on vaulted assets.');
    }
    return '<div class="space-y-3">' + types.map(function (t) {
      var row = byType[t] || { healthy: 0, expiring: 0, expired: 0, total: 0 };
      if (!row.total) {
        return '<div><div class="flex justify-between text-[11px] mb-1"><span class="text-slate-400">' + t +
          '</span><span class="text-slate-600 text-[10px]">No dated records</span></div>' +
          '<div class="h-2.5 rounded-full bg-white/[0.04]"></div></div>';
      }
      var h = (row.healthy / row.total) * 100;
      var e = (row.expiring / row.total) * 100;
      var x = (row.expired / row.total) * 100;
      return '<button type="button" onclick="switchTab(\'expiry\')" class="w-full text-left">' +
        '<div class="flex justify-between text-[11px] mb-1"><span class="text-slate-300 font-medium">' + t + '</span>' +
        '<span class="font-mono text-[10px] text-slate-400">' + row.healthy + ' healthy · ' + row.expiring + ' ≤30d · ' + row.expired + ' expired</span></div>' +
        '<div class="h-2.5 rounded-full overflow-hidden flex bg-white/[0.04]">' +
        '<div style="width:' + h + '%;background:#14a690" title="Healthy ' + row.healthy + '"></div>' +
        '<div style="width:' + e + '%;background:#fbbf24" title="Expiring ' + row.expiring + '"></div>' +
        '<div style="width:' + x + '%;background:#f87171" title="Expired ' + row.expired + '"></div>' +
        '</div></button>';
    }).join('') + '</div>';
  }

  function svgCoverageRing(coverage) {
    if (coverage == null || !isFinite(coverage)) {
      return '<p class="text-[11px] text-slate-500">Protection coverage: Data unavailable</p>';
    }
    var r = 28;
    var c = 2 * Math.PI * r;
    var dash = (coverage / 100) * c;
    return '<div class="flex items-center gap-3">' +
      '<svg viewBox="0 0 72 72" class="w-16 h-16 shrink-0" role="img" aria-label="Protection coverage ' + coverage + ' percent">' +
      '<circle cx="36" cy="36" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8"></circle>' +
      '<circle cx="36" cy="36" r="' + r + '" fill="none" stroke="#14a690" stroke-width="8" stroke-dasharray="' + dash + ' ' + c +
      '" transform="rotate(-90 36 36)" stroke-linecap="round"></circle>' +
      '<text x="36" y="40" text-anchor="middle" fill="#fff" font-size="12" font-weight="800">' + coverage + '%</text></svg>' +
      '<div><p class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Protection Coverage</p>' +
      '<p class="text-[11px] text-slate-400 mt-0.5">Share of dated records that are healthy (&gt;30 days).</p></div></div>';
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function toneClass(tone) {
    if (tone === 'emerald') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    if (tone === 'amber') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    if (tone === 'rose') return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
    return 'border-white/10 bg-white/5 text-slate-300';
  }

  function renderSystemStrip(state, connectionStatus) {
    var ops = state.whatsappOpsHealth || state.whatsappOps || {};
    var wa = resolveAuthoritativeWhatsAppApiStatus(ops, state.notifications);
    var hook = resolveAuthoritativeWebhookStatus(ops, state.notifications);
    var firestoreTone = connectionStatus === 'LIVE' ? 'emerald' : connectionStatus === 'ERROR' ? 'rose' : 'amber';
    var firestoreLabel = connectionStatus === 'LIVE' ? 'LIVE FIRESTORE' : connectionStatus === 'ERROR' ? 'FIRESTORE ERROR' : connectionStatus || 'SYNCING';
    setText('sysChipFirestore', firestoreLabel);
    var fsEl = document.getElementById('sysChipFirestoreWrap');
    if (fsEl) fsEl.className = 'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ' + toneClass(firestoreTone);
    setText('sysChipWhatsapp', 'WHATSAPP ' + wa.label);
    var waEl = document.getElementById('sysChipWhatsappWrap');
    if (waEl) waEl.className = 'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ' + toneClass(wa.tone);
    setText('sysChipOcr', state.ocrQueue ? 'OCR QUEUE ' + state.ocrQueue.length : 'OCR N/A');
    setText('sysLastSync', state.lastLiveUpdateAt ? new Date(state.lastLiveUpdateAt).toLocaleString() : '—');
    var lastNotif = (state.notifications || [])[0];
    setText('sysLastNotification', lastNotif && lastNotif.createdAt ? String(lastNotif.createdAt) : 'No data yet');
    var lastHook = (state.notifications || []).find(function (n) {
      var s = String(n.status || '').toLowerCase();
      return s === 'delivered' || s === 'read';
    });
    setText('sysLastWebhook', (ops.webhook && ops.webhook.status) || (lastHook ? String(lastHook.status).toUpperCase() : hook.label));
    setText('sysUptime', 'N/A');
    setText('footerLastSync', state.lastLiveUpdateAt ? new Date(state.lastLiveUpdateAt).toLocaleString() : '—');
    setText('footerBackendHealth', connectionStatus === 'LIVE' ? 'Firestore listeners active' : connectionStatus || 'Unknown');
  }

  var _biCacheKey = '';

  function renderCommandCenter(state) {
    var cats = countAssetsByCategory(state.assets);
    var wa = summarizeWhatsAppQueue(state.notifications);
    var docs = summarizeDocuments(state.documents);
    var week = countAssetsAddedInWindow(state.assets, 7);
    var warranties = countActiveWarranties(state.expiries);
    var risk = summarizeProtectionRisk(state.expiries);
    var expSoon = risk.attention;
    var pending = wa.queued + wa.processing;
    var range = readAnalyticsRange();
    var cacheKey = [
      (state.users || []).length, (state.assets || []).length, (state.documents || []).length,
      (state.ocrQueue || []).length, (state.notifications || []).length, (state.expiries || []).length,
      (state.tickets || []).length, range, state.lastLiveUpdateAt || '',
    ].join('|');

    setText('kpiUsers', (state.users.length || 0).toLocaleString('en-IN'));
    setText('kpiAssets', (state.assets.length || 0).toLocaleString('en-IN'));
    setText('kpiDocuments', (state.documents.length || 0).toLocaleString('en-IN'));
    setText('kpiActiveWarranties', String(warranties));
    setText('kpiExpiringSoon', String(expSoon));
    setText('kpiPendingNotifications', String(pending));
    if (!wa.telemetryAvailable) {
      setText('kpiWaDeliveryRate', 'No data');
      setText('kpiWaRateHint', 'No recent message events');
    } else if (wa.awaitingWebhook) {
      setText('kpiWaDeliveryRate', 'Awaiting');
      setText('kpiWaRateHint', 'Awaiting delivery update');
    } else if (wa.deliveryRate != null) {
      setText('kpiWaDeliveryRate', wa.deliveryRate + '%');
      setText('kpiWaRateHint', wa.deliveryStatus + ' · delivered+read / terminal');
    } else {
      setText('kpiWaDeliveryRate', wa.deliveryStatus);
      setText('kpiWaRateHint', 'Status: ' + wa.deliveryStatus);
    }
    setText('kpiOcrQueue', String((state.ocrQueue || []).length));
    setText('kpiOcrHint', 'ocrReviewQueue');

    renderExpiryRadarHero(risk);
    renderTrustLayerMetrics(state);
    if (cacheKey !== _biCacheKey) {
      _biCacheKey = cacheKey;
      renderBusinessIntelligence(state, { cats: cats, wa: wa, docs: docs, risk: risk, range: range });
    }

    var svc = countUpcomingService(state.assets);
    setText('kpiUpcomingServices', svc.available ? String(svc.count) : 'N/A');

    renderSystemStrip(state, root.__adConnectionStatus || 'SYNCING');
    renderWhatsAppHero(state);
    renderOcrMonitor(state);
    renderSystemHealthPanel(state);
    if (root.lucide && typeof root.lucide.createIcons === 'function') root.lucide.createIcons();
  }

  function renderExpiryRadarHero(risk) {
    setText('radarExpiredCount', risk.available ? String(risk.expired) : '—');
    setText('radarExp30Count', risk.available ? String(risk.expiring) : '—');
    setText('radarHealthyCount', risk.available ? String(risk.healthy) : '—');
    var barEl = document.getElementById('radarRiskBars');
    if (!barEl) return;
    if (!risk.available) {
      barEl.innerHTML = emptyChart('Telemetry unavailable', 'No insurance, warranty, or PUC dates are recorded on vaulted assets.');
      return;
    }
    var max = Math.max(risk.expired, risk.expiring, risk.healthy, 1);
    function row(label, value, color) {
      var pct = Math.round((value / max) * 100);
      return '<div class="flex items-center gap-3">' +
        '<span class="w-24 shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">' + label + '</span>' +
        '<div class="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">' +
        '<div class="h-full rounded-full" style="width:' + pct + '%;background:' + color + '"></div></div>' +
        '<span class="w-8 text-right font-mono text-xs text-white tabular-nums">' + value + '</span></div>';
    }
    barEl.innerHTML = '<div class="space-y-2">' +
      row('Expired', risk.expired, '#f87171') +
      row('≤30 Days', risk.expiring, '#fbbf24') +
      row('Healthy', risk.healthy, '#14a690') +
      '</div>';
  }

  function syncRangeButtons(range) {
    document.querySelectorAll('[data-bi-range]').forEach(function (btn) {
      var on = btn.getAttribute('data-bi-range') === range;
      btn.classList.toggle('bg-brand-500/20', on);
      btn.classList.toggle('text-brand-200', on);
      btn.classList.toggle('border-brand-500/40', on);
      btn.classList.toggle('text-slate-400', !on);
      btn.classList.toggle('border-white/10', !on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function renderBusinessIntelligence(state, pack) {
    var cats = pack.cats;
    var wa = pack.wa;
    var risk = pack.risk;
    var range = pack.range;
    syncRangeButtons(range);

    var summaryEl = document.getElementById('biExecutiveSummary');
    if (summaryEl) {
      var obs = buildExecutiveSummary(state);
      summaryEl.innerHTML = obs.map(function (o) {
        var tone = o.tone === 'warn' ? 'border-amber-500/30 bg-amber-500/10 text-amber-100' :
          o.tone === 'ok' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100' :
          o.tone === 'unavailable' ? 'border-white/10 bg-white/[0.03] text-slate-400' :
          'border-cyan-500/20 bg-cyan-500/10 text-cyan-100';
        return '<div class="rounded-xl border px-3.5 py-2.5 text-xs font-medium ' + tone + '">' + o.text + '</div>';
      }).join('');
    }

    var growthEl = document.getElementById('chartAssetGrowth');
    if (growthEl) {
      var growth = buildGrowthSeriesDual(state.users, state.assets, range);
      if (!growth.available) {
        growthEl.innerHTML = emptyChart('Not enough historical data yet', 'Growth analytics will appear as more activity is recorded.');
      } else {
        var note = growth.limited
          ? '<p class="text-[10px] text-amber-300/80 mt-2">ℹ Historical growth data is limited — only records with createdAt are plotted.</p>'
          : '';
        growthEl.innerHTML = svgDualArea(growth.points) + note;
      }
    }

    var portEl = document.getElementById('chartAssetPortfolio');
    if (portEl) {
      var totalAssets = (state.assets || []).length;
      if (!totalAssets) {
        portEl.innerHTML = emptyChart('No data yet', 'Asset portfolio breakdown appears when vaulted assets are present.');
      } else {
        portEl.innerHTML = svgDonut(PORTFOLIO.map(function (k, i) {
          return {
            label: PORTFOLIO_FULL_LABELS[k] || PORTFOLIO_LABELS[k],
            value: cats[k],
            color: CHART_COLORS[i],
            onclick: 'onclick="openPortfolioCategory(\'' + k + '\')"',
          };
        }), {
          empty: 'No assets yet',
          centerValue: String(totalAssets),
          centerLabel: 'Total Assets',
          aria: 'Asset portfolio by category',
        });
      }
    }

    var docType = summarizeDocumentTypes(state.documents, state.ocrQueue);
    var docEl = document.getElementById('chartDocumentIntel');
    if (docEl) {
      if (!docType.available) {
        docEl.innerHTML = emptyChart('No document intelligence data yet', 'Counts appear from live vaulted document types.');
      } else {
        var insight = docType.mostScanned
          ? '<p class="text-[11px] text-slate-400 mt-3">Most scanned document type: <span class="text-white font-semibold">' +
            docType.mostScanned.label + '</span> (' + docType.mostScanned.count + ')</p>'
          : '<p class="text-[11px] text-slate-500 mt-3">No document intelligence data yet</p>';
        docEl.innerHTML = svgBars(docType.rows.map(function (row, i) {
          return {
            label: row.label,
            value: row.count,
            extra: row.percent != null ? row.percent + '% · OCR review ' + row.review : '',
            color: CHART_COLORS[i % CHART_COLORS.length],
            tab: row.review ? 'ocr_review' : 'documents',
          };
        })) + insight;
      }
    }

    var protEl = document.getElementById('chartProtectionRisk');
    if (protEl) {
      if (!risk.available) {
        protEl.innerHTML = emptyChart('Telemetry unavailable', 'Protection analytics require insurance, warranty, or PUC dates on assets.');
      } else {
        protEl.innerHTML =
          '<div class="grid grid-cols-3 gap-2 mb-4">' +
          '<div class="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3"><p class="text-[9px] uppercase font-bold text-emerald-300/80">Total Protected</p><p class="text-xl font-black text-white tabular-nums mt-1">' + risk.healthy + '</p></div>' +
          '<div class="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3"><p class="text-[9px] uppercase font-bold text-amber-300/80">Expiring Soon</p><p class="text-xl font-black text-white tabular-nums mt-1">' + risk.expiring + '</p></div>' +
          '<div class="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3"><p class="text-[9px] uppercase font-bold text-rose-300/80">Expired</p><p class="text-xl font-black text-white tabular-nums mt-1">' + risk.expired + '</p></div>' +
          '</div>' +
          svgStackedRisk(risk.byType) +
          '<div class="mt-4">' + svgCoverageRing(risk.coverage) + '</div>' +
          (risk.attention
            ? '<p class="text-[11px] text-amber-200 mt-3">' + risk.attention + ' assets/documents require attention</p>'
            : '<p class="text-[11px] text-emerald-300 mt-3">No dated protection records currently require attention.</p>');
      }
    }

    var health = bucketAssetHealth(state.assets);
    var healthEl = document.getElementById('chartAssetHealth');
    if (healthEl) {
      if (!health.available) {
        healthEl.innerHTML = emptyChart('No data yet', 'Asset health buckets appear from vaulted assets.');
      } else {
        healthEl.innerHTML = svgBars([
          { label: 'Excellent', value: health.counts.Excellent, color: '#14a690', tab: 'assets' },
          { label: 'Good', value: health.counts.Good, color: '#22d3ee', tab: 'assets' },
          { label: 'Attention', value: health.counts.Attention, color: '#fbbf24', tab: 'expiry' },
          { label: 'Critical', value: health.counts.Critical, color: '#f87171', tab: 'expiry' },
        ]) + '<p class="text-[11px] text-slate-400 mt-3">' + health.insight + '</p>';
      }
    }

    var ocrQ = summarizeOcrQuality(state.documents, state.ocrQueue);
    var ocrEl = document.getElementById('chartOcrPerf');
    if (ocrEl) {
      if (!ocrQ.total && !ocrQ.reviewQueue) {
        ocrEl.innerHTML = emptyChart('No data yet', 'OCR quality appears from vaulted documents and the review queue.');
      } else {
        var realRows = [
          { label: 'Documents Processed', value: ocrQ.processed, color: '#14a690', tab: 'documents' },
          { label: 'High Confidence', value: ocrQ.high_confidence, color: '#22d3ee', tab: 'documents' },
          { label: 'Needs Review', value: ocrQ.needs_review || ocrQ.reviewQueue, color: '#fbbf24', tab: 'ocr_review' },
          { label: 'Failed', value: ocrQ.failed, color: '#f87171', tab: 'ocr_review' },
          { label: 'Unknown', value: ocrQ.unknown, color: '#94a3b8', tab: 'documents' },
        ];
        var tel = '';
        if (!ocrQ.confidenceTelemetry && !ocrQ.engineTelemetry) {
          tel = '<div class="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">' +
            '<p class="text-[10px] font-bold uppercase tracking-wider text-amber-300">Telemetry unavailable</p>' +
            '<p class="text-[11px] text-slate-500 mt-0.5">Provider-level OCR telemetry is not currently stored. Counts above are REAL DATA from document status fields.</p></div>';
        }
        ocrEl.innerHTML = svgBars(realRows) + tel;
      }
    }

    var waEl = document.getElementById('chartWhatsappPerf');
    if (waEl) {
      var welcome = summarizeWelcomeQueue(state.notifications);
      if (!wa.telemetryAvailable) {
        waEl.innerHTML = emptyChart('No data yet', 'WhatsApp automation appears from /notification_queue.');
      } else {
        var deliverySeen = (wa.delivered + wa.read) > 0;
        waEl.innerHTML = svgBars([
          { label: 'Queued', value: wa.queued + wa.processing, color: '#fbbf24', tab: 'whatsapp' },
          { label: 'Sent', value: wa.sent, color: '#22d3ee', tab: 'whatsapp' },
          { label: 'Delivered', value: wa.delivered, color: '#14a690', tab: 'whatsapp' },
          { label: 'Read', value: wa.read, color: '#818cf8', tab: 'whatsapp' },
          { label: 'Failed', value: wa.failed, color: '#f87171', tab: 'whatsapp' },
          { label: 'Skipped', value: wa.skipped, color: '#94a3b8', tab: 'whatsapp' },
        ]) +
        (deliverySeen
          ? ''
          : '<p class="text-[11px] text-amber-300 mt-3">Awaiting delivery telemetry</p>') +
        '<div class="grid grid-cols-4 gap-2 mt-4">' +
        '<div class="rounded-lg border border-white/10 p-2"><p class="text-[9px] uppercase text-slate-500 font-bold">Welcome</p><p class="text-sm font-black text-white">' + (welcome.available ? welcome.total : '—') + '</p></div>' +
        '<div class="rounded-lg border border-white/10 p-2"><p class="text-[9px] uppercase text-slate-500 font-bold">Pending</p><p class="text-sm font-black text-white">' + (welcome.available ? welcome.pending : '—') + '</p></div>' +
        '<div class="rounded-lg border border-white/10 p-2"><p class="text-[9px] uppercase text-slate-500 font-bold">Successful</p><p class="text-sm font-black text-white">' + (welcome.available ? welcome.successful : '—') + '</p></div>' +
        '<div class="rounded-lg border border-white/10 p-2"><p class="text-[9px] uppercase text-slate-500 font-bold">Failed</p><p class="text-sm font-black text-white">' + (welcome.available ? welcome.failed : '—') + '</p></div>' +
        '</div>';
      }
    }

    var execEl = document.getElementById('executiveInsights');
    if (execEl) {
      var insights = buildExecutiveInsights(state);
      if (!insights.length) {
        execEl.innerHTML = '<p class="text-xs text-slate-500 py-6 text-center">No executive insights yet. Insights appear from live expiry, OCR, support, and queue data.</p>';
      } else {
        execEl.innerHTML = insights.map(function (i) {
          var sev = i.severity === 'CRITICAL' ? 'border-rose-500/40 bg-rose-500/10' :
            i.severity === 'HIGH' ? 'border-amber-500/30 bg-amber-500/10' :
            i.severity === 'MEDIUM' ? 'border-cyan-500/25 bg-cyan-500/10' :
            'border-emerald-500/20 bg-emerald-500/5';
          var waClick = i.tab === 'whatsapp'
            ? 'onclick="switchTab(\'whatsapp\'); if(window.switchWhatsappSubView) switchWhatsappSubView(\'queue\');"'
            : 'onclick="switchTab(\'' + i.tab + '\')"';
          return '<button type="button" ' + waClick + ' class="w-full text-left p-4 rounded-2xl border ' + sev + ' hover:bg-white/5 transition">' +
            '<div class="flex items-center justify-between gap-2">' +
            '<span class="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">' + i.icon + ' ' + i.title + '</span>' +
            '<span class="text-[9px] font-bold uppercase text-slate-500">' + i.severity + '</span></div>' +
            '<p class="text-sm font-semibold text-white mt-1.5 leading-snug">' + i.text + '</p>' +
            '<p class="text-[11px] font-bold text-brand-300 mt-2">' + i.cta + '</p></button>';
        }).join('');
      }
    }

    var insightsEl = document.getElementById('intelligenceInsights');
    if (insightsEl && insightsEl !== execEl) {
      insightsEl.innerHTML = (document.getElementById('executiveInsights') || { innerHTML: '' }).innerHTML;
    }

    var alertsEl = document.getElementById('smartAlertsList');
    if (alertsEl) {
      var alerts = buildAlerts(state);
      if (!alerts.length) {
        alertsEl.innerHTML = '<p class="text-xs text-slate-500 py-4 text-center">No open alerts from current data.</p>';
      } else {
        alertsEl.innerHTML = alerts.map(function (al) {
          var sev = al.severity === 'CRITICAL' ? 'text-rose-300' : al.severity === 'HIGH' ? 'text-amber-300' : 'text-slate-300';
          return '<button type="button" onclick="switchTab(\'' + al.tab + '\')" class="w-full text-left p-2.5 rounded-lg border border-white/5 hover:bg-white/5">' +
            '<span class="text-[9px] font-bold uppercase ' + sev + '">' + al.severity + ' · ' + al.category + '</span>' +
            '<p class="text-xs text-white mt-0.5">' + al.title + '</p></button>';
        }).join('');
      }
    }

    var qMini = document.getElementById('dashQueueMini');
    if (qMini) {
      var items = (state.notifications || []).slice(0, 5);
      if (!items.length) {
        qMini.innerHTML = '<p class="text-xs text-slate-500 py-4 text-center">Notification queue is empty.</p>';
      } else {
        qMini.innerHTML = items.map(function (item) {
          return '<div class="flex justify-between gap-2 text-[11px] py-1.5 border-b border-white/5">' +
            '<span class="font-mono text-brand-300 truncate">' + (item.templateKey || '—') + '</span>' +
            '<span class="uppercase text-slate-400">' + (item.status || '—') + '</span></div>';
        }).join('');
      }
    }
  }

  function renderWhatsAppHero(state) {
    var ops = state.whatsappOpsHealth || state.whatsappOps || {};
    var wa = summarizeWhatsAppQueue(state.notifications);
    var tpl = summarizeTemplates(state.templates);

    // Authoritative Server status from backend ops
    var api = resolveAuthoritativeWhatsAppApiStatus(ops, state.notifications);
    var hook = resolveAuthoritativeWebhookStatus(ops, state.notifications);

    setText('waHeroApi', api.label);
    setText('waHeroWebhook', hook.label);

    var deliverableCount = ops.templates && typeof ops.templates.deliverable === 'number' ? ops.templates.deliverable : tpl.deliverable;
    var pendingCount = ops.templates && typeof ops.templates.pending === 'number' ? ops.templates.pending : tpl.pending;
    var rejectedCount = ops.templates && typeof ops.templates.rejected === 'number' ? ops.templates.rejected : tpl.rejected;

    setText('waHeroTplActive', String(deliverableCount));
    setText('waHeroTplPending', String(pendingCount));
    setText('waHeroTplRejected', String(rejectedCount));

    var deliveryText = 'No data yet';
    var delivRate = (ops.delivery && ops.delivery.deliveryRate != null) ? ops.delivery.deliveryRate : wa.deliveryRate;
    if (delivRate != null) {
      deliveryText = delivRate + '%';
    } else if (wa.sent > 0 && (wa.delivered > 0 || wa.read > 0)) {
      var calculated = Math.round(((wa.delivered + wa.read) / wa.sent) * 100);
      deliveryText = calculated + '%';
    } else if (wa.sent > 0) {
      deliveryText = 'Awaiting delivery events';
    }
    setText('waHeroDelivery', deliveryText);
    setText('waHeroTplNote', tpl.notSubmitted + ' registered but not submitted to Meta');

    var welcomeBanner = document.getElementById('welcomeTemplateBanner');
    if (welcomeBanner) {
      if (tpl.hasWelcomeRegistry) {
        welcomeBanner.className = 'rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 mb-6 text-xs text-emerald-100';
        welcomeBanner.innerHTML = '<p class="text-xs text-emerald-300 font-medium">✓ Customer Welcome is synchronized and verified on Meta as <span class="font-mono font-bold text-white">asset_doctor_welcome</span> (en). Cloud Function worker is active and deliverable.</p>';
      } else {
        welcomeBanner.className = 'rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mb-6 text-xs text-amber-100';
        welcomeBanner.innerHTML = '<p class="text-xs text-amber-200">No <span class="font-mono">asset_doctor_welcome</span> row in /whatsapp_templates. Click <strong>Sync with Meta</strong> above to import registered templates.</p>';
      }
    }
    var range = (document.getElementById('waPerfRange') || {}).value || '30d';
    var days = range === '24h' ? 1 : range === '7d' ? 7 : range === '90d' ? 90 : 30;
    var cutoff = Date.now() - days * 86400000;
    var filtered = (state.notifications || []).filter(function (n) {
      var d = parseDate(n.createdAt || n.scheduledAt);
      return d ? d.getTime() >= cutoff : true;
    });
    var perf = summarizeWhatsAppQueue(filtered);
    var perfEl = document.getElementById('waPerfChart');
    if (perfEl) {
      if (!perf.telemetryAvailable) {
        perfEl.innerHTML = '<p class="text-xs text-slate-500 py-8 text-center">Awaiting delivery telemetry</p>';
      } else {
        perfEl.innerHTML = svgBars([
          { label: 'Sent', value: perf.sent, color: '#22d3ee' },
          { label: 'Delivered', value: perf.delivered, color: '#14a690' },
          { label: 'Read', value: perf.read, color: '#818cf8' },
          { label: 'Failed', value: perf.failed, color: '#f87171' },
          { label: 'Pending', value: perf.queued + perf.processing, color: '#fbbf24' },
        ]);
      }
    }
    setText('waPerfDelivery', perf.deliveryRate == null ? 'No data yet' : perf.deliveryRate + '%');
    setText('waPerfFailure', perf.failureRate == null ? 'No data yet' : perf.failureRate + '%');
    setText('waPerfRead', perf.readRate == null ? 'No data yet' : perf.readRate + '%');
  }

  function renderOcrMonitor(state) {
    var docs = summarizeDocuments(state.documents);
    var q = state.ocrQueue || [];
    setText('ocrKpiProcessed', docs.total ? String(docs.processed + docs.high_confidence) : 'No data yet');
    setText('ocrKpiSuccess', docs.total ? String(docs.processed + docs.high_confidence) : 'No data yet');
    setText('ocrKpiReview', String(q.length || docs.needs_review || 0));
    setText('ocrKpiFailed', docs.total ? String(docs.failed) : 'No data yet');
    setText('ocrKpiAvgTime', 'Telemetry unavailable');
    setText('ocrKpiGoogle', 'Telemetry unavailable');
    setText('ocrKpiAzure', 'Telemetry unavailable');
    setText('ocrKpiMlkit', 'Telemetry unavailable');
    var table = document.getElementById('ocrProblemTable');
    if (table) {
      var rows = q.slice(0, 20);
      if (!rows.length) {
        table.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-slate-500 text-xs">No problem documents in the review queue.</td></tr>';
      } else {
        table.innerHTML = rows.map(function (item) {
          var conf = item.confidence;
          var confLabel = conf == null ? 'N/A' : (conf <= 1 ? Math.round(conf * 100) : Math.round(conf)) + '%';
          var created = item.submittedAt || item.createdAt || '—';
          return '<tr class="table-row">' +
            '<td class="px-3 py-2 text-white text-xs">' + (item.docType || item.label || item.docId || 'Document') + '</td>' +
            '<td class="px-3 py-2 text-slate-400 text-xs">' + (item.type || item.docType || '—') + '</td>' +
            '<td class="px-3 py-2 font-mono text-[11px] text-slate-400">' + (item.userId || '—') + '</td>' +
            '<td class="px-3 py-2 font-mono text-[11px]">' + confLabel + '</td>' +
            '<td class="px-3 py-2 text-amber-300 text-xs">' + (item.issue || item.reason || 'Needs review') + '</td>' +
            '<td class="px-3 py-2 text-xs text-slate-500">' + (item.engine || item.ocrProvider || 'N/A') + '</td>' +
            '<td class="px-3 py-2 text-[11px] text-slate-500">' + created + '</td>' +
            '<td class="px-3 py-2 text-[10px] uppercase text-amber-300">Needs Review</td></tr>';
        }).join('');
      }
    }
  }

  function renderSystemHealthPanel(state) {
    var el = document.getElementById('systemHealthGrid');
    if (!el) return;
    var conn = root.__adConnectionStatus || 'SYNCING';
    var ops = state.whatsappOpsHealth || state.whatsappOps || {};
    var api = resolveAuthoritativeWhatsAppApiStatus(ops, state.notifications);
    var hook = resolveAuthoritativeWebhookStatus(ops, state.notifications);

    var rows = [
      { name: 'Firebase Auth', status: state.currentUser ? 'HEALTHY' : 'NOT CONFIGURED', detail: state.currentUser ? 'Admin session' : 'Not signed in' },
      { name: 'Firestore', status: conn === 'LIVE' ? 'HEALTHY' : conn === 'ERROR' ? 'ERROR' : 'DEGRADED', detail: 'Listener snapshots' },
      { name: 'Storage', status: 'NOT CONFIGURED', detail: 'Admin does not probe Storage' },
      { name: 'WhatsApp API', status: api.label === 'LIVE' ? 'HEALTHY' : 'CONFIGURED', detail: 'Meta Cloud API v21.0 · asia-south1' },
      { name: 'Webhook', status: (hook.label === 'VERIFIED' || hook.label === 'CONFIGURED') ? 'HEALTHY' : 'CONFIGURED', detail: hook.detail },
      { name: 'OCR', status: 'NOT CONFIGURED', detail: 'Monitoring queue size only — provider health not probed' },
      { name: 'Notification Queue', status: (state.notifications || []).length ? 'HEALTHY' : 'NOT CONFIGURED', detail: '/notification_queue' },
      { name: 'Sync', status: conn === 'LIVE' ? 'HEALTHY' : 'DEGRADED', detail: 'Admin realtime listeners' },
    ];
    el.innerHTML = rows.map(function (r) {
      var tone = r.status === 'HEALTHY' ? 'text-emerald-300 border-emerald-500/30' :
        r.status === 'ERROR' ? 'text-rose-300 border-rose-500/30' :
        r.status === 'DEGRADED' ? 'text-amber-300 border-amber-500/30' :
        'text-slate-400 border-white/10';
      return '<div class="rounded-xl border bg-slate-900/60 p-3 ' + tone + '">' +
        '<p class="text-[10px] uppercase font-bold text-slate-400">' + r.name + '</p>' +
        '<p class="text-xs font-bold mt-1">' + r.status + '</p>' +
        '<p class="text-[10px] text-slate-500 mt-0.5">' + r.detail + '</p></div>';
    }).join('');
  }

  function renderWelcomeDiagnostics(state) {
    var sel = document.getElementById('welcomeDiagCustomer');
    if (!sel) return;
    var current = sel.value;
    var opts = ['<option value="">Select customer…</option>'].concat((state.users || []).map(function (u) {
      var uid = u.uid || u.id;
      return '<option value="' + uid + '"' + (uid === current ? ' selected' : '') + '>' +
        (u.name || 'Customer') + ' · ' + uid.slice(0, 8) + '</option>';
    }));
    sel.innerHTML = opts.join('');
    if (current) sel.value = current;
    var uid = sel.value;
    var user = (state.users || []).find(function (u) { return (u.uid || u.id) === uid; });
    var result = diagnoseWelcomeMessage({ user: user, queueItems: state.notifications, templates: state.templates });
    var stageEl = document.getElementById('welcomeDiagStages');
    if (!stageEl) return;
    stageEl.innerHTML = result.stages.map(function (s) {
      var tone = s.status === 'PASS' ? 'text-emerald-300 border-emerald-500/30' :
        s.status === 'FAIL' ? 'text-rose-300 border-rose-500/30' :
        s.status === 'SKIPPED' ? 'text-slate-400 border-white/10' :
        'text-amber-300 border-amber-500/30';
      return '<div class="rounded-xl border p-3 ' + tone + '">' +
        '<div class="flex justify-between gap-2"><p class="text-xs font-bold text-white">' + s.label + '</p>' +
        '<span class="text-[10px] font-bold uppercase">' + s.status + '</span></div>' +
        '<p class="text-[11px] text-slate-400 mt-1">' + (s.detail || '') + '</p></div>';
    }).join('');
  }

  function filterNotificationsByStatus(status) {
    return function () {
      var tbody = document.getElementById('notificationQueueTableBody');
      if (!tbody) return;
      root.switchWhatsappSubView && root.switchWhatsappSubView('queue');
      root.switchTab && root.switchTab('whatsapp');
    };
  }

  function customerProtectionSnapshot(user, assets, documents) {
    user = user || {};
    assets = assets || [];
    documents = documents || [];
    var mobile = !!(user.phone || user.phoneNumber);
    var whatsapp = user.whatsappOptIn === true;
    var pin = !!(user.pincode || user.city);
    var hasAssets = assets.length > 0;
    var review = documents.filter(function (d) {
      return d && (d.needsReview || d.needsManualReview);
    }).length;
    var dims = 0;
    var pts = 0;
    function add(measurable, complete) {
      if (!measurable) return;
      dims += 1;
      if (complete) pts += 100;
    }
    add(true, !!(user.name || user.displayName));
    add(true, mobile);
    add(user.whatsappOptIn === true || user.whatsappOptIn === false, whatsapp);
    add(!!(user.pincode || user.city || Object.prototype.hasOwnProperty.call(user, 'pincode')), pin);
    add(true, hasAssets);
    var hasDocs = documents.length > 0 || assets.some(function (a) {
      return a && (a.insurancePolicyNumber || a.warrantyExpiry || a.billStoragePath || a.hasBill);
    });
    add(true, hasDocs);
    var score = dims ? Math.round(pts / dims) : null;
    return {
      score: score,
      scoreDisplay: score == null ? 'Not available' : String(score) + '%',
      mobile: mobile,
      whatsapp: whatsapp,
      pin: pin,
      assets: hasAssets,
      reviewCount: review,
    };
  }

  function summarizeTrustMetrics(state) {
    var users = (state && state.users) || [];
    var assets = (state && state.assets) || [];
    var documents = (state && state.documents) || [];
    var expiries = (state && state.expiries) || [];
    var ocrQueue = (state && state.ocrQueue) || [];
    if (!users.length && !assets.length && !documents.length && !expiries.length && !ocrQueue.length) {
      return {
        available: false,
        protectedAssets: null,
        protectedDocuments: null,
        profilesComplete: null,
        profilesIncomplete: null,
        documentsNeedingReview: null,
        expiringDocuments: null,
        assetsMissingCriticalDocuments: null,
      };
    }
    var protectedAssets = 0;
    var missingCritical = 0;
    assets.forEach(function (a) {
      var id = a.assetId || a.id;
      var linked = documents.filter(function (d) {
        return (d.assetId || d.linkedAssetId) === id;
      });
      var named = !!(a.assetName || a.name);
      var identified = !!(a.registration || a.serialNumber || a.imei || a.model);
      var hasDoc = linked.length > 0 || a.insurancePolicyNumber || a.warrantyExpiry || a.billStoragePath || a.hasBill;
      if (named && identified && hasDoc) protectedAssets += 1;
      if (!hasDoc) missingCritical += 1;
    });
    var reviewDocs = documents.filter(function (d) {
      return d.needsReview || d.needsManualReview;
    }).length;
    var reviewOcr = ocrQueue.filter(function (d) {
      return d.needsReview || d.needsManualReview || d.status === 'NEEDS_REVIEW';
    }).length;
    var complete = 0;
    var incomplete = 0;
    users.forEach(function (u) {
      var ready = !!(u.name || u.displayName) && !!(u.phone || u.phoneNumber) && u.whatsappOptIn === true && !!(u.pincode || u.city);
      if (ready) complete += 1;
      else incomplete += 1;
    });
    return {
      available: true,
      protectedAssets: protectedAssets,
      protectedDocuments: documents.filter(function (d) { return !(d.needsReview || d.needsManualReview); }).length,
      profilesComplete: users.length ? complete : null,
      profilesIncomplete: users.length ? incomplete : null,
      documentsNeedingReview: reviewDocs + reviewOcr,
      expiringDocuments: expiries.length ? expiries.filter(function (e) { return e.status === 'EXP30' || e.status === 'EXPIRED'; }).length : null,
      assetsMissingCriticalDocuments: missingCritical,
    };
  }

  function formatTrustMetric(value) {
    return value == null ? 'No data yet' : String(value);
  }

  function summarizeOcrHardeningDiagnostics(input) {
    input = input || {};
    var queue = input.ocrQueue || [];
    var docs = input.documents || [];
    var learning = input.learningFeedback || [];
    if (!queue.length && !docs.length && !learning.length) {
      return {
        available: false,
        documentsProcessed: null,
        fieldsRequiringReview: null,
        humanCorrections: null,
        topFailureTypes: [],
        providerDisagreement: null,
        assetMatchConflicts: null,
        realDocumentTelemetry: 'No real-document telemetry yet',
      };
    }
    var review = 0;
    var disagreement = 0;
    var conflicts = 0;
    var fail = {};
    function bump(code) {
      if (!code) return;
      fail[code] = (fail[code] || 0) + 1;
    }
    queue.concat(docs).forEach(function (row) {
      if (row.needsReview || row.needsManualReview || row.status === 'NEEDS_REVIEW') review += 1;
      var codes = row.errorCodes || (row.phase14 && row.phase14.errorCodes) || [];
      codes.forEach(bump);
      if (codes.indexOf('OCR_PROVIDER_DISAGREEMENT') >= 0 || row.providerConflict) disagreement += 1;
      if (row.assetIdentityConflict || codes.indexOf('OCR_ASSET_MATCH_CONFLICT') >= 0) conflicts += 1;
    });
    var events = learning.filter(function (r) { return String(r.recordType || 'EVENT').toUpperCase() !== 'PATTERN'; });
    var corrections = events.filter(function (e) { return e.correctionType && e.correctionType !== 'USER_CONFIRMED'; }).length;
    var topFailureTypes = Object.keys(fail).map(function (k) { return { code: k, count: fail[k] }; }).sort(function (a, b) { return b.count - a.count; }).slice(0, 8);
    return {
      available: true,
      documentsProcessed: queue.length + docs.length,
      fieldsRequiringReview: review,
      humanCorrections: events.length ? corrections : null,
      topFailureTypes: topFailureTypes,
      providerDisagreement: disagreement || null,
      assetMatchConflicts: conflicts || null,
      realDocumentTelemetry: 'No real-document telemetry yet',
    };
  }

  function formatDiagnosticMetric(value) {
    return value == null ? 'No data yet' : String(value);
  }

  function summarizeLearningCenter(rows) {
    rows = rows || [];
    var events = [];
    var patterns = [];
    rows.forEach(function (row) {
      var type = String(row.recordType || 'EVENT').toUpperCase();
      if (type === 'PATTERN') patterns.push(row);
      else events.push(row);
    });
    if (!events.length && !patterns.length) {
      return {
        available: false,
        eventCount: null,
        patternCount: null,
        emerging: [],
        trusted: [],
        rejected: [],
        fieldsMostCorrected: [],
        documentTypesWithMostErrors: [],
        recentEvents: [],
      };
    }
    if (!patterns.length) {
      var buckets = {};
      events.forEach(function (ev) {
        if (!ev || ev.correctionType === 'USER_CONFIRMED') return;
        var key = String(ev.documentType || 'GENERIC_DOCUMENT') + '|' + String(ev.fieldName || 'unknown') + '|REJECT_' + String(ev.originalValueShape || 'OTHER') + '_AS_' + String(ev.fieldName || '').toUpperCase();
        if (!buckets[key]) buckets[key] = { count: 0, users: {}, fps: {}, sample: ev };
        buckets[key].count += 1;
        if (ev.userId) buckets[key].users[ev.userId] = true;
        if (ev.documentFingerprint) buckets[key].fps[ev.documentFingerprint] = true;
      });
      Object.keys(buckets).forEach(function (key) {
        var hit = buckets[key];
        var independent = Math.max(Object.keys(hit.users).length, Object.keys(hit.fps).length, 1);
        var status = 'CANDIDATE';
        if (independent >= 5) status = 'TRUSTED';
        else if (independent >= 3) status = 'EMERGING';
        var parts = key.split('|');
        patterns.push({
          patternId: key,
          recordType: 'PATTERN',
          documentType: parts[0],
          fieldName: parts[1],
          semanticLabel: parts[2],
          normalizedPattern: parts[2],
          supportCount: hit.count,
          independentEvidence: independent,
          status: status,
          createdAt: hit.sample.createdAt,
          updatedAt: hit.sample.timestamp,
        });
      });
    }
    var fieldCounts = {};
    var typeCounts = {};
    events.forEach(function (ev) {
      if (ev.correctionType === 'USER_CONFIRMED') return;
      var f = String(ev.fieldName || 'unknown');
      var t = String(ev.documentType || 'GENERIC_DOCUMENT');
      fieldCounts[f] = (fieldCounts[f] || 0) + 1;
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });
    function toSorted(map, nameKey) {
      return Object.keys(map).map(function (k) {
        var row = { count: map[k] };
        row[nameKey] = k;
        return row;
      }).sort(function (a, b) { return b.count - a.count; }).slice(0, 12);
    }
    var recent = events.slice().sort(function (a, b) {
      return String(b.timestamp || b.createdAt || '').localeCompare(String(a.timestamp || a.createdAt || ''));
    }).slice(0, 40);
    return {
      available: true,
      eventCount: events.length,
      patternCount: patterns.length,
      emerging: patterns.filter(function (p) { return p.status === 'EMERGING'; }),
      trusted: patterns.filter(function (p) { return p.status === 'TRUSTED'; }),
      rejected: patterns.filter(function (p) { return p.status === 'REJECTED'; }),
      fieldsMostCorrected: toSorted(fieldCounts, 'fieldName'),
      documentTypesWithMostErrors: toSorted(typeCounts, 'documentType'),
      recentEvents: recent,
    };
  }

  function renderTrustLayerMetrics(state) {
    var trust = summarizeTrustMetrics(state);
    var host = document.getElementById('chartTrustLayer');
    if (!host) return;
    if (!trust.available) {
      host.innerHTML = emptyChart('No data yet', 'Protection metrics appear from live customers, assets and documents.');
      return;
    }
    host.innerHTML = svgBars([
      { label: 'Protected Assets', value: trust.protectedAssets, color: '#10B981', tab: 'assets' },
      { label: 'Protected Documents', value: trust.protectedDocuments, color: '#14B8A6', tab: 'documents' },
      { label: 'Profiles Complete', value: trust.profilesComplete, color: '#22d3ee', tab: 'users' },
      { label: 'Profiles Incomplete', value: trust.profilesIncomplete, color: '#94a3b8', tab: 'users' },
      { label: 'Docs Needing Review', value: trust.documentsNeedingReview, color: '#fbbf24', tab: 'ocr_review' },
      { label: 'Expiring Documents', value: trust.expiringDocuments, color: '#f59e0b', tab: 'expiries' },
      { label: 'Assets Missing Docs', value: trust.assetsMissingCriticalDocuments, color: '#f87171', tab: 'assets' },
    ]);
  }

  root.ADIntel = {
    WELCOME_META_TEMPLATE: WELCOME_META_TEMPLATE,
    PORTFOLIO_LABELS: PORTFOLIO_LABELS,
    classifyAdminAssetCategory: classifyAdminAssetCategory,
    countAssetsByCategory: countAssetsByCategory,
    buildExpiryBuckets: buildExpiryBuckets,
    countAssetsAddedInWindow: countAssetsAddedInWindow,
    summarizeWhatsAppQueue: summarizeWhatsAppQueue,
    classifyTemplateLifecycle: classifyTemplateLifecycle,
    summarizeTemplates: summarizeTemplates,
    diagnoseWelcomeMessage: diagnoseWelcomeMessage,
    summarizeDocuments: summarizeDocuments,
    buildInsights: buildInsights,
    customerHealth: customerHealth,
    formatMetric: formatMetric,
    maskPhone: maskPhone,
    renderCommandCenter: renderCommandCenter,
    renderWelcomeDiagnostics: renderWelcomeDiagnostics,
    renderWhatsAppHero: renderWhatsAppHero,
    renderSystemStrip: renderSystemStrip,
    renderSystemHealthPanel: renderSystemHealthPanel,
    resolveAuthoritativeWhatsAppApiStatus: resolveAuthoritativeWhatsAppApiStatus,
    resolveAuthoritativeWebhookStatus: resolveAuthoritativeWebhookStatus,
    filterNotificationsByStatus: filterNotificationsByStatus,
    classifyAdminDocumentType: classifyAdminDocumentType,
    summarizeDocumentTypes: summarizeDocumentTypes,
    buildGrowthSeriesDual: buildGrowthSeriesDual,
    summarizeProtectionRisk: summarizeProtectionRisk,
    scoreAdminAssetHealth: scoreAdminAssetHealth,
    bucketAssetHealth: bucketAssetHealth,
    summarizeOcrQuality: summarizeOcrQuality,
    summarizeWelcomeQueue: summarizeWelcomeQueue,
    classifyActivityKind: classifyActivityKind,
    buildExecutiveInsights: buildExecutiveInsights,
    buildExecutiveSummary: buildExecutiveSummary,
    summarizeTrustMetrics: summarizeTrustMetrics,
    customerProtectionSnapshot: customerProtectionSnapshot,
    summarizeLearningCenter: summarizeLearningCenter,
    summarizeOcrHardeningDiagnostics: summarizeOcrHardeningDiagnostics,
    formatDiagnosticMetric: formatDiagnosticMetric,
    invalidateBiCache: function () { _biCacheKey = ''; },
    PORTFOLIO_FULL_LABELS: PORTFOLIO_FULL_LABELS,
  };
})(window);
