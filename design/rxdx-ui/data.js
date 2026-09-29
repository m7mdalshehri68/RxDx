/* RxDx UI — strings, icons and the example encounter. Clinical content is English in both languages. */
window.RX = window.RX || {};

RX.ICON = (function () {
  var P = {
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>',
    pill: '<path d="M8.5 20.5 20.5 8.5a4.24 4.24 0 0 0-6-6L2.5 14.5a4.24 4.24 0 0 0 6 6z"/><path d="m8.5 8.5 6 6"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5z"/>',
    note: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    exit: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21H14"/><path d="M11 12h10m-3-3 3 3-3 3"/>',
    shield: '<path d="M12 3 19 6v5.6c0 4.3-2.9 7.6-7 9.2-4.1-1.6-7-4.9-7-9.2V6z"/><path d="m9 12.2 2.1 2.1 4-4.2"/>',
    check: '<path d="m5 12.5 4.2 4L19 7"/>',
    review: '<path d="M4 5h16v11H9l-5 4z"/><path d="m9 10.5 2 2 4-4"/>',
    braces: '<path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.4M12 17h.01"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    scale: '<path d="M12 3v18M5 7h14M5 7l-3 7a3.5 3.5 0 0 0 6 0zM19 7l-3 7a3.5 3.5 0 0 0 6 0zM8 21h8"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
    folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
    gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="m12 14 4-5"/>',
    words: '<path d="M4 7V5h16v2M12 5v14M9 19h6"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    learn: '<path d="M2 9 12 4l10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
    stetho: '<path d="M6.5 3.5H5a1 1 0 0 0-1 1V9a5 5 0 0 0 10 0V4.5a1 1 0 0 0-1-1h-1.5"/><path d="M9 14v1.5a5 5 0 0 0 10 0V13"/><circle cx="19" cy="11" r="2"/>',
    building: '<path d="M4 21V5l8-2v18M12 7l8 2v12M8 9h.01M8 13h.01M8 17h.01M16 13h.01M16 17h.01M2 21h20"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    download: '<path d="M12 4v11m-4-4 4 4 4-4M5 20h14"/>',
    send: '<path d="m21 3-9.5 9.5M21 3l-6.5 18-3-8.5L3 9.5z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    paste: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 11h6M9 15h4"/>',
    upload: '<path d="M12 16V5m-4 4 4-4 4 4M5 20h14"/>',
    sample: '<path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h3"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4.5M12 17.5v.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>',
    family: '<circle cx="8" cy="7" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M2.5 20a5.5 5.5 0 0 1 11 0M13.5 20a4 4 0 0 1 8 0"/>',
    q: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.4M12 17h.01"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    side: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    doc: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5"/>'
  };
  return function (n, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (P[n] || '') + '</svg>';
  };
})();

RX.T = {
  ar: {
    ribbon: 'تعمل داخل المتصفح — نص المريض لا يُحفظ ولا يُرسل تلقائياً',
    gate_h: 'اختر مساحة العمل', doctor: 'الطبيب', mgmt: 'الإدارة', it: 'تقنية المعلومات',
    doctor_d: 'بحث واحد في الأدوية والتشخيصات، وترميز الملاحظة مع الدليل من نصها، وما سيطلبه التأمين.',
    mgmt_d: 'مخاطر الإيرادات وجودة التوثيق وبروتوكولات شركات التأمين في لمحة.',
    it_d: 'مركز التحكم، ومراجعة ما تعلّمه النظام، وسجل المحتوى.',
    enter: 'ادخل مساحة العمل',
    g_find: 'البحث', g_doc: 'التوثيق', g_ref: 'المراجع', g_review: 'المراجعة', g_tools: 'أدوات', g_help: 'الدعم', g_mgmt: 'الإدارة', g_it: 'تقنية المعلومات',
    s_search: 'البحث', s_drugs: 'دليل الأدوية', s_icd: 'تشخيصات ICD-10', s_note: 'الملاحظة ← الأكواد', s_hx: 'بناء التاريخ المرضي', s_er: 'الطوارئ', s_dis: 'ترميز الخروج',
    s_ind: 'الدواعي السريرية', s_pa: 'الموافقة المسبقة', s_review: 'مراجعة المرمِّز', s_struct: 'الإدخال المنظّم', s_calc: 'الحاسبات', s_help: 'المساعدة',
    s_exec: 'لوحة الإدارة', s_payers: 'بروتوكولات التأمين', s_insights: 'المؤشرات', s_clin: 'الأطباء', s_content: 'سجل المحتوى', s_pilot: 'قياس التجربة', s_vocab: 'مفردات من الرفض',
    s_cc: 'مركز التحكم', s_learn: 'مراجعة التعلّم',
    offline: 'المحرك داخل المتصفح', online: 'الخدمة عبر الإنترنت · متصلة', online_waking: 'الخدمة عبر الإنترنت',
    signout: 'خروج', collapse: 'طيّ القائمة', larger: 'تكبير النص', theme: 'المظهر', lang: 'English',
    online_warn: 'خدمة الترميز عبر الإنترنت مفعّلة: يُرسل نص الملاحظة إلى الخادم لترميزه.', turn_off: 'إيقاف',
    engine_menu_h: 'محرك الترميز', engine_off_d: 'يعمل داخل المتصفح. لا يغادر النص الجهاز.', engine_on_l: 'خدمة الترميز عبر الإنترنت', engine_on_d: 'اختيارية ومتوقفة افتراضياً. تُرسل نص الملاحظة للخدمة.',
    note_card: 'الملاحظة السريرية', paste: 'لصق', upload: 'رفع', sample: 'ملاحظة نموذجية', clear: 'مسح', chars: 'حرف',
    age: 'العمر', sex: 'الجنس', female: 'أنثى', male: 'ذكر', enc: 'نوع الزيارة', op: 'عيادة', er: 'طوارئ', ip: 'تنويم', insurer: 'شركة التأمين', all3: 'الثلاث',
    analyze: 'حلّل', edit: 'تعديل', stale: 'تغيّرت الملاحظة. حلّل من جديد لتحديث النتيجة.',
    placeholder: 'اكتب الملاحظة أو الصقها هنا — بالإنجليزية',
    analysing: 'جارٍ التحليل', skip: 'تخطٍّ',
    st1: 'قراءة الملاحظة', st2: 'إيجاد الحالات', st3: 'استبعاد المنفي والتاريخ العائلي', st4: 'اختيار التشخيص الرئيسي', st5: 'المطابقة مع قائمة المستشفى', st6: 'التحقق',
    waking: 'تشغيل الخدمة…', waking_d: 'قد تستغرق الخدمة المجانية حتى 15 ثانية لتستيقظ. بعدها يتولى محرك المتصفح.',
    fallback: 'رُمّزت داخل المتصفح — الخدمة غير متاحة', via_online: 'رُمّزت عبر الخدمة',
    principal: 'التشخيص الرئيسي', additional: 'التشخيصات الإضافية', notcoded: 'لم يُرمَّز', gaps: 'نواقص التوثيق', validation: 'التحقق', ask: 'ما سيطلبه التأمين',
    confirmed: 'مؤكد', why: 'لماذا رئيسي', supports: 'يدعم', affects: 'يؤثر على', evidence: 'الدليل', treatment: 'العلاج', investigation: 'الفحوصات', monitoring: 'المتابعة',
    high: 'عالية', checkc: 'راجِع', low: 'منخفضة', conf: 'الثقة',
    sig_h: 'إشارات الثقة', sig1: 'تطابق حرفي للعبارة', sig2: 'الدقة مستوفاة', sig3: 'لا يوجد ما يعارضه', sig4: 'اجتاز التحقق', sig2no: 'الدقة غير مستوفاة',
    nc_intro: 'ما تركه RxDx عمداً، وسبب كل واحد.',
    denied: 'منفي', ruled: 'مستبعد', family: 'تاريخ عائلي', uncertain: 'غير مؤكد', integral: 'عرض جزء من التشخيص',
    query: 'استفسار للطبيب', copy: 'نسخ', copied: 'نُسخ',
    v1: 'ضمن قائمة المستشفى', v2: 'قيود الجنس والعمر', v3: 'مقبول كتشخيص رئيسي', v4: 'كود واحد لكل حالة', v5: 'الدليل موجود في الملاحظة', v6: 'الدقة مدعومة',
    pass: 'اجتاز', warn: 'تنبيه',
    open_items: 'بنود مفتوحة', write_here: 'اكتبه في الملاحظة', src: 'المصدر',
    a_copy: 'نسخ الأكواد', a_claim: 'نسخ للمطالبة', a_export: 'تصدير', a_fhir: 'FHIR R4 JSON', a_csv: 'CSV', a_review: 'إرسال لمراجعة المرمِّز', a_new: 'ملاحظة جديدة', a_final: 'اعتماد',
    t_copied: 'نُسخت الأكواد', t_claim: 'نُسخ نص المطالبة', t_review: 'أُرسلت لمراجعة المرمِّز', t_export: 'صُدِّر الملف', t_final: 'اعتُمدت الملاحظة وسُجّل السبب', t_final_ok: 'اعتُمدت الملاحظة',
    fin_h: 'اعتماد مع بنود مفتوحة', fin_b: 'هناك {g} نواقص توثيق و{i} بنود للتأمين لم تُجب. يمكنك الاعتماد الآن؛ اكتب سبباً في سطر واحد وسيُسجَّل.',
    fin_reason: 'السبب', fin_ph: 'مثال: سأستكملها بعد نتيجة الأشعة', cancel: 'إلغاء', finalise_anyway: 'اعتماد',
    empty_h: 'ابدأ بالملاحظة', empty_p: 'اكتب الملاحظة أو الصقها، ثم حلّل. تظهر هنا الأكواد مع الجملة التي تثبت كل كود.',
    nodx_h: 'لم يُعثر على تشخيص.', nodx_p: 'تأكد من كتابة التقييم (Assessment) في الملاحظة.',
    only_sample: 'هذا النموذج يرمّز الملاحظة المثال فقط. الأداة الحية ترمّز أي ملاحظة.', open_live: 'افتح الأداة الحية',
    m_codes: 'الأكواد', m_evidence: 'الدليل', m_gaps: 'النواقص', m_insurer: 'التأمين', m_review: 'مراجعة',
    proto: 'نموذج', ps_empty: 'فارغ', ps_anal: 'تحليل', ps_result: 'نتيجة', ps_nodx: 'بلا تشخيص', ps_down: 'الخدمة متعذرة', ps_long: 'ملاحظة طويلة', ps_pct: 'نسبة معايرة',
    shortcuts: 'اختصارات لوحة المفاتيح', k_palette: 'لوحة الأوامر', k_analyze: 'حلّل', k_jk: 'الكود التالي / السابق', k_e: 'إظهار الدليل وإخفاؤه', k_help: 'هذه القائمة', k_esc: 'إغلاق / تخطٍّ',
    cmd_ph: 'ابحث عن كود أو دواء أو شاشة', g_codes: 'أكواد', g_drugs: 'أدوية', g_screens: 'شاشات',
    search_ph: 'ابحث في كل شيء — تشخيص أو كود أو دواء أو اسم تجاري', icd_ph: 'ابحث عن تشخيص أو كود', drug_ph: 'ابحث عن دواء أو اسم تجاري',
    codes_n: 'كود', drugs_n: 'دواء', click_copy: 'انقر للنسخ', results_for: 'نتيجة',
    e_sex: 'كلا الجنسين', e_f: 'أنثى فقط', e_pdx: 'مقبول كرئيسي', e_nopdx: 'غير مقبول كرئيسي', e_morph: 'يلزم كود الشكل النسيجي', e_age: 'العمر',
    brands: 'الأسماء التجارية', indications: 'الدواعي', sfda: 'SFDA',
    hx_complaint: 'الشكوى', hx_leave: 'قبل المغادرة', hx_leave_h: 'قبل أن يغادر المريض', hx_leave_p: 'ما سيطلبه التأمين ولم يُكتب بعد.', hx_done: 'مكتمل',
    hs1: 'التاريخ', hs2: 'الأعراض', hs3: 'علامات الخطر', hs4: 'الخلفية', hs5: 'الفحص', hs6: 'التشخيص', hs7: 'التوثيق', hs8: 'الخطة', hs9: 'إنشاء',
    next: 'التالي', back: 'السابق', yes: 'نعم', no: 'لا', generate: 'إنشاء الملاحظة', gen_h: 'الملاحظة (بالإنجليزية)', to_codes: 'حلّل في الملاحظة ← الأكواد',
    kpi1: 'ملاحظات رُمّزت', kpi2: 'أكواد لها دليل', kpi3: 'نواقص توثيق مفتوحة', kpi4: 'بنود التأمين أُجيبت قبل المغادرة', vs_last: 'عن الشهر الماضي',
    demo: 'بيانات تجريبية', top_gaps: 'أكثر النواقص تكراراً', by_dept: 'حسب القسم',
    et1: 'نظرة عامة', et2: 'إيرادات معرّضة للخطر', et3: 'جودة التوثيق', et4: 'الحوكمة السريرية', et5: 'الاستخدام', et6: 'تقرير المجلس',
    pt1: 'نظرة عامة', pt2: 'متى يلزم الطلب', pt3: 'القواعد والمهل', pt4: 'مكتبة التوثيق', pt5: 'الجاهزية', pt6: 'أين تختلف الشركات', pt7: 'دليل الأقسام', pt8: 'جداول الحمل', pt9: 'مشكلات الأكواد',
    service: 'الخدمة', sets: 'مجموعات متطلبات', questions: 'سؤال', services_req: 'خدمة تحتاج طلباً',
    rq1: 'توثيق ضعيف', rq2: 'ثقة منخفضة', rq3: 'تعارض بين الكود والملاحظة', rq4: 'غير محدد مع وجود كود محدد', rq5: 'إجراء بلا كود',
    accept: 'قبول', change: 'تغيير', reject: 'رفض', reason_ph: 'السبب في سطر واحد', record: 'سجّل القرار', teaches: 'يُضاف قرارك إلى مراجعة المفردات.',
    t_decided: 'سُجّل القرار', suggested: 'الكود المقترح', not_in_proto: 'هذه الشاشة تبقى بتصميمها الحالي في الأداة الحية.',
    ageband: 'الفئة العمرية'
  },
  en: {
    ribbon: 'Runs in your browser — patient text is not saved or sent automatically',
    gate_h: 'Choose your workspace', doctor: 'Doctor', mgmt: 'Management', it: 'IT',
    doctor_d: 'One search across drugs and diagnoses, notes coded with the sentence behind each code, and what the insurer will ask.',
    mgmt_d: 'Revenue at risk, documentation quality and payer protocols at a glance.',
    it_d: 'Control Centre, review of what the engine learned, and the content register.',
    enter: 'Enter workspace',
    g_find: 'Find', g_doc: 'Documentation', g_ref: 'Reference', g_review: 'Review', g_tools: 'Tools', g_help: 'Support', g_mgmt: 'Management', g_it: 'IT',
    s_search: 'Search', s_drugs: 'Drug Formulary', s_icd: 'ICD-10 Diagnosis', s_note: 'Note → Codes', s_hx: 'History Builder', s_er: 'Emergency', s_dis: 'Discharge coding',
    s_ind: 'Clinical indications', s_pa: 'Pre-authorisation', s_review: 'Coder review', s_struct: 'Structured', s_calc: 'Calculators', s_help: 'Help',
    s_exec: 'Executive dashboard', s_payers: 'Payer protocols', s_insights: 'Insights', s_clin: 'Clinicians', s_content: 'Content register', s_pilot: 'Pilot measurement', s_vocab: 'Vocabulary from refusals',
    s_cc: 'Control Centre', s_learn: 'Learning review',
    offline: 'Offline engine', online: 'Online service · connected', online_waking: 'Online service',
    signout: 'Sign out', collapse: 'Collapse sidebar', larger: 'Larger text', theme: 'Theme', lang: 'العربية',
    online_warn: 'The online coding service is on: the note text is sent to the server to be coded.', turn_off: 'Turn off',
    engine_menu_h: 'Coding engine', engine_off_d: 'Runs in the browser. The text never leaves the device.', engine_on_l: 'Online coding service', engine_on_d: 'Optional and off by default. Sends the note text to the service.',
    note_card: 'Clinical note', paste: 'Paste', upload: 'Upload', sample: 'Sample note', clear: 'Clear', chars: 'characters',
    age: 'Age', sex: 'Sex', female: 'Female', male: 'Male', enc: 'Encounter', op: 'Outpatient', er: 'Emergency', ip: 'Inpatient', insurer: 'Insurer', all3: 'All three',
    analyze: 'Analyze', edit: 'Edit', stale: 'The note changed. Analyze again to update the result.',
    placeholder: 'Write or paste the note here — in English',
    analysing: 'Analysing', skip: 'Skip',
    st1: 'Reading the note', st2: 'Finding conditions', st3: 'Setting aside what is denied or family history', st4: 'Choosing the principal diagnosis', st5: "Matching to the hospital's ICD-10-AM list", st6: 'Validating',
    waking: 'Waking the service…', waking_d: 'The free service can take up to 15 seconds to wake. After that the browser engine takes over.',
    fallback: 'Coded in the browser — service unreachable', via_online: 'Coded by the online service',
    principal: 'Principal diagnosis', additional: 'Additional diagnoses', notcoded: 'Not coded', gaps: 'Documentation gaps', validation: 'Validation', ask: 'What the insurer will ask',
    confirmed: 'Confirmed', why: 'Why principal', supports: 'Supports', affects: 'Affects', evidence: 'Evidence', treatment: 'Treatment', investigation: 'Investigation', monitoring: 'Monitoring',
    high: 'High', checkc: 'Check', low: 'Low', conf: 'Confidence',
    sig_h: 'Confidence signals', sig1: 'Exact phrase match', sig2: 'Specificity met', sig3: 'No conflicting finding', sig4: 'Validation passed', sig2no: 'Specificity not met',
    nc_intro: 'What RxDx deliberately left out, and why.',
    denied: 'Denied', ruled: 'Ruled out', family: 'Family history', uncertain: 'Uncertain', integral: 'Integral symptom',
    query: 'Physician query', copy: 'Copy', copied: 'Copied',
    v1: "In the hospital's list", v2: 'Sex and age edits', v3: 'Acceptable as principal', v4: 'One code per condition', v5: 'Evidence found in the note', v6: 'Specificity supported',
    pass: 'Pass', warn: 'Warning',
    open_items: 'open items', write_here: 'Write it in the note', src: 'Source',
    a_copy: 'Copy codes', a_claim: 'Copy for claim', a_export: 'Export', a_fhir: 'FHIR R4 JSON', a_csv: 'CSV', a_review: 'Send to coder review', a_new: 'New note', a_final: 'Finalise',
    t_copied: 'Codes copied', t_claim: 'Claim text copied', t_review: 'Sent to coder review', t_export: 'File exported', t_final: 'Note finalised, reason recorded', t_final_ok: 'Note finalised',
    fin_h: 'Finalise with open items', fin_b: '{g} documentation gaps and {i} insurer items are still open. You can finalise now; give a one-line reason and it will be recorded.',
    fin_reason: 'Reason', fin_ph: 'For example: will complete after the MRI result', cancel: 'Cancel', finalise_anyway: 'Finalise',
    empty_h: 'Start with the note', empty_p: 'Write or paste the note, then analyze. The codes appear here with the sentence behind each one.',
    nodx_h: 'No diagnosis was found.', nodx_p: 'Check that the assessment is written.',
    only_sample: 'This prototype codes the example note only. The live tool codes any note.', open_live: 'Open the live tool',
    m_codes: 'Codes', m_evidence: 'Evidence', m_gaps: 'Gaps', m_insurer: 'Insurer', m_review: 'Review',
    proto: 'Prototype', ps_empty: 'Empty', ps_anal: 'Analysing', ps_result: 'Result', ps_nodx: 'No diagnosis', ps_down: 'Service down', ps_long: 'Long note', ps_pct: 'Calibrated %',
    shortcuts: 'Keyboard shortcuts', k_palette: 'Command palette', k_analyze: 'Analyze', k_jk: 'Next / previous code', k_e: 'Show or hide evidence', k_help: 'This sheet', k_esc: 'Close / skip',
    cmd_ph: 'Search codes, drugs and screens', g_codes: 'Codes', g_drugs: 'Drugs', g_screens: 'Screens',
    search_ph: 'Search everything — diagnosis, code, drug or brand name', icd_ph: 'Search a diagnosis or code', drug_ph: 'Search a drug or brand name',
    codes_n: 'codes', drugs_n: 'drugs', click_copy: 'Click to copy', results_for: 'results',
    e_sex: 'Either sex', e_f: 'Female only', e_pdx: 'Accepted as principal', e_nopdx: 'Not accepted as principal', e_morph: 'Morphology code required', e_age: 'Age',
    brands: 'Brand names', indications: 'Indications', sfda: 'SFDA',
    hx_complaint: 'Complaint', hx_leave: 'Before leaving', hx_leave_h: 'Before the patient leaves', hx_leave_p: 'What the insurer will ask that nothing written answers yet.', hx_done: 'Complete',
    hs1: 'History', hs2: 'Symptoms', hs3: 'Red flags', hs4: 'Background', hs5: 'Examination', hs6: 'Diagnosis', hs7: 'Documentation', hs8: 'Plan', hs9: 'Generate',
    next: 'Next', back: 'Back', yes: 'Yes', no: 'No', generate: 'Generate note', gen_h: 'Note (English)', to_codes: 'Analyze in Note → Codes',
    kpi1: 'Notes coded', kpi2: 'Codes with evidence', kpi3: 'Open documentation gaps', kpi4: 'Insurer items answered before discharge', vs_last: 'vs last month',
    demo: 'Demo data', top_gaps: 'Most frequent gaps', by_dept: 'By department',
    et1: 'Overview', et2: 'Revenue at risk', et3: 'Documentation quality', et4: 'Clinical governance', et5: 'Adoption', et6: 'Board report',
    pt1: 'Overview', pt2: 'When a request is needed', pt3: 'Rules and deadlines', pt4: 'Documentation library', pt5: 'Readiness', pt6: 'Where payers differ', pt7: 'Department playbook', pt8: 'Antenatal schedules', pt9: 'Code issues',
    service: 'Service', sets: 'requirement sets', questions: 'questions', services_req: 'services need a request',
    rq1: 'Thin documentation', rq2: 'Low confidence', rq3: 'Code–note disagreement', rq4: 'Unspecified where a specific code exists', rq5: 'Procedure without a code',
    accept: 'Accept', change: 'Change', reject: 'Reject', reason_ph: 'Reason, in one line', record: 'Record decision', teaches: 'Your decision is added to the vocabulary review.',
    t_decided: 'Decision recorded', suggested: 'Suggested code', not_in_proto: 'This screen keeps its current design in the live tool.',
    ageband: 'Age band'
  }
};

/* the example encounter */
RX.NOTE = '55-year-old woman with neck pain radiating to the left arm for 3 weeks, with numbness in the left thumb.\n' +
  'Known type 2 diabetes on metformin and hypertension on amlodipine.\n' +
  'No trauma. No fever.\n' +
  'Mother had breast cancer.\n' +
  'Examination: reduced left biceps reflex.\n' +
  'Assessment: cervical radiculopathy.\n' +
  'Plan: MRI cervical spine, physiotherapy, pregabalin, HbA1c.';

RX.LONG_TAIL = '\n\nHistory of presenting illness: pain began gradually without a clear trigger, worse on looking up and on turning the head to the left, eased by rest and paracetamol. ' +
  'Numbness is intermittent and limited to the thumb and index finger. No weakness of grip reported. Sleep disturbed by pain on two to three nights a week. Works at a desk for most of the day.\n' +
  'Medication: metformin 1 g twice daily, amlodipine 5 mg once daily, paracetamol as needed. No known drug allergies.\n' +
  'Social: non-smoker, no alcohol. Lives with her family.\n' +
  'Review of systems: no chest pain, no shortness of breath, no weight loss, no night sweats.\n' +
  'Examination (continued): neck range of motion limited in extension and left rotation. Spurling test positive on the left. Power 5/5 in both upper limbs. Sensation reduced over the left thumb. Gait normal.\n' +
  'Discussion: symptoms and signs in keeping with a left C6 radiculopathy. No red flags on history or examination today. Safety-netting advice given.';

RX.CODES = [
  { code: 'M54.12', desc: 'Radiculopathy, cervical region', role: 'principal', conf: 'high', pct: 94,
    ev: ['Assessment: cervical radiculopathy', 'neck pain radiating to the left arm', 'reduced left biceps reflex'],
    rule: 'ACS 0001',
    why: { en: 'The assessment names it and the plan treats it (MRI, physiotherapy, pregabalin); diabetes and hypertension are only continued.',
           ar: 'التقييم يسمّيه والخطة تعالجه (رنين مغناطيسي، علاج طبيعي، بريجابالين)؛ أما السكري والضغط فمستمران فقط.' },
    signals: [1, 1, 1, 1] },
  { code: 'E11.9', desc: 'Type 2 diabetes mellitus without complication', role: 'additional', conf: 'check', pct: 71,
    ev: ['type 2 diabetes on metformin', 'HbA1c'], supports: 'HbA1c, metformin', affects: ['treatment', 'investigation', 'monitoring'], signals: [1, 0, 1, 1] },
  { code: 'I10', desc: 'Essential (primary) hypertension', role: 'additional', conf: 'high', pct: 92,
    ev: ['hypertension on amlodipine'], supports: 'amlodipine', affects: ['treatment', 'monitoring'], signals: [1, 1, 1, 1] }
];

RX.NOTCODED = [
  { what: 'Trauma', span: 'No trauma', reason: 'denied', icon: 'ban' },
  { what: 'Fever', span: 'No fever', reason: 'denied', icon: 'ban' },
  { what: 'Breast cancer', span: 'Mother had breast cancer', reason: 'family', icon: 'family' },
  { what: 'Numbness, left thumb', span: 'numbness in the left thumb', reason: 'integral', icon: 'link', of: 'M54.12' }
];

RX.GAPS = [
  { code: 'M54.12', text: 'Cause not stated; a documented disc disorder would change the code.',
    q: 'Please document the cause of the cervical radiculopathy if known, for example disc prolapse or spondylosis, with the level if imaging shows it.' },
  { code: 'E11.9', text: 'Complications and control not documented.',
    q: 'Please document whether the type 2 diabetes has any complications, and whether it is currently controlled.' }
];

/* requirement sets from preauth/PA.json */
RX.ASK = {
  bupa: { src: 'Bupa Prerequisites, p.4', groups: [
    { g: 'Physiotherapy', items: [
      { q: 'Duration, primary cause and initial management', hint: 'Detailed history', ins: 'Physiotherapy request: duration __ weeks; primary cause __; initial management __.' },
      { q: 'Examination: range of motion, reflexes, strength', hint: 'Physical examination findings', ins: 'Examination: neck range of motion __; reflexes __; upper limb strength __.' } ] },
    { g: 'Red flags to record', items: [
      { q: 'Progressive arm weakness', hint: 'State present or absent', ins: 'Red flags: progressive arm weakness __.' },
      { q: 'Gait or bladder change', hint: 'State present or absent', ins: 'Red flags: gait change __; bladder change __.' } ] } ] },
  taw: { src: 'Tawuniya MDS · Physiotherapy', groups: [
    { g: 'Physiotherapy', items: [
      { q: 'Yellow flags or red flag signs', hint: 'The duration is already written (3 weeks)', ins: 'Red and yellow flags: __.' },
      { q: 'Documented failure of medical therapy and of home exercise, for at least 4 to 6 weeks', hint: 'Treatment tried and for how long', ins: 'Conservative treatment tried: __ for __ weeks, response __.' },
      { q: 'The modalities requested match this diagnosis in the clinical guidelines', hint: 'Name the modalities', ins: 'Physiotherapy modalities requested: __.' } ] } ] },
  art: { src: 'Tawuniya MDS · Physiotherapy (shared by Al Rajhi Takaful)', groups: [
    { g: 'Physiotherapy', items: [
      { q: 'Yellow flags or red flag signs', hint: 'The duration is already written (3 weeks)', ins: 'Red and yellow flags: __.' },
      { q: 'Documented failure of medical therapy and of home exercise, for at least 4 to 6 weeks', hint: 'Treatment tried and for how long', ins: 'Conservative treatment tried: __ for __ weeks, response __.' } ] } ] }
};

RX.RECOG = ['neck pain', 'left arm', 'numbness', 'left thumb', 'type 2 diabetes', 'metformin', 'hypertension', 'amlodipine', 'trauma', 'fever', 'breast cancer',
  'biceps reflex', 'cervical radiculopathy', 'MRI', 'physiotherapy', 'pregabalin', 'HbA1c'];

RX.LIB = [
  { code: 'M54.12', desc: 'Radiculopathy, cervical region', e: ['e_sex', 'e_pdx'] },
  { code: 'M54.2', desc: 'Cervicalgia', e: ['e_sex', 'e_pdx'] },
  { code: 'M50.1', desc: 'Cervical disc disorder with radiculopathy', e: ['e_sex', 'e_pdx'] },
  { code: 'M47.2', desc: 'Other spondylosis with radiculopathy', e: ['e_sex', 'e_pdx'] },
  { code: 'E11.9', desc: 'Type 2 diabetes mellitus without complication', e: ['e_sex', 'e_pdx'] },
  { code: 'E11.65', desc: 'Type 2 diabetes mellitus with poor control', e: ['e_sex', 'e_pdx'] },
  { code: 'I10', desc: 'Essential (primary) hypertension', e: ['e_sex', 'e_pdx'] },
  { code: 'R07.4', desc: 'Chest pain, unspecified', e: ['e_sex', 'e_pdx'] },
  { code: 'O24.4', desc: 'Diabetes mellitus arising in pregnancy', e: ['e_f', 'e_pdx', 'age:12–55'] },
  { code: 'C50.9', desc: 'Malignant neoplasm of breast, unspecified', e: ['e_sex', 'e_pdx', 'e_morph'] },
  { code: 'Z80.3', desc: 'Family history of malignant neoplasm of breast', e: ['e_sex', 'e_nopdx'] },
  { code: 'J45.9', desc: 'Asthma, unspecified', e: ['e_sex', 'e_pdx'] }
];

RX.DRUGS = [
  { n: 'Metformin', b: 'Glucophage · Glucophage XR', cls: 'Biguanide', ind: [{ t: 'Type 2 diabetes mellitus', c: ['E11.9', 'E11.65'] }] },
  { n: 'Amlodipine', b: 'Norvasc', cls: 'Calcium channel blocker', ind: [{ t: 'Essential hypertension', c: ['I10'] }, { t: 'Chronic stable angina', c: ['I20.8'] }] },
  { n: 'Pregabalin', b: 'Lyrica', cls: 'Gabapentinoid', ind: [{ t: 'Neuropathic pain', c: ['M54.12', 'G62.9'] }, { t: 'Generalised anxiety disorder', c: ['F41.1'] }] },
  { n: 'Paracetamol', b: 'Panadol · Adol', cls: 'Analgesic', ind: [{ t: 'Pain, mild to moderate', c: ['R52.9'] }, { t: 'Fever', c: ['R50.9'] }] },
  { n: 'Atorvastatin', b: 'Lipitor', cls: 'Statin', ind: [{ t: 'Hyperlipidaemia', c: ['E78.5'] }] }
];

/* services that need a request, from preauth/PA.json (trig) */
RX.MATRIX = [
  ['Physiotherapy sessions', 1, 1, 1], ['MRI', 1, 0, 1], ['CT scan', 1, 0, 1], ['Chemotherapy', 1, 1, 1], ['Radiotherapy', 1, 1, 1],
  ['Dialysis — every session', 1, 1, 1], ['EMG and nerve conduction studies', 1, 0, 0], ['Speech and occupational therapy', 1, 0, 0],
  ['Home health care services', 1, 0, 0], ['Nuclear scan', 1, 0, 0], ['Dental services', 1, 1, 1], ['Intra-articular joint injections', 1, 0, 0]
];
