// ═══════════════════════════════════════════════════════════════════════════
// summer-camp.js  —  Summer Camp 2026 Certificate Management Module
// مَكْتَبُ فَاطِمَةَ لِلْبَنَاتِ
//
// ARCHITECTURE: Vanilla JS module matching existing index.html pattern.
// Database: Firebase Realtime Database (same as existing system).
// Injected into existing sidebar + section system — NOT a separate page.
//
// HOW TO INTEGRATE:
//   1. Add <script src="summer-camp.js"></script> before </body> in index.html
//   2. Call SummerCamp.init() after Firebase is connected (see integration note)
//   3. Paste the sidebar HTML snippet into the nav (see SIDEBAR SNIPPET below)
//   4. Paste the section div into main content (see SECTION SNIPPET below)
// ═══════════════════════════════════════════════════════════════════════════

const SummerCamp = (() => {

  // ── State ────────────────────────────────────────────────────────────────
  let _db       = null;   // Firebase database reference (set on init)
  let _baseRef  = null;   // db.ref('summerCamp2026')
  let _allCerts = {};     // local mirror of certificates node
  let _settings = {
    programName:  'سمر کیمپ ۲۰۲۶',
    startDate:    '2026-06-01',
    endDate:      '2026-06-30',
    directorName: 'مدیرہ مکتب فاطمہ',
    principalName:'پرنسپل',
    counter:      0
  };
  let _currentSubSection = 'sc-dashboard';

  // ══════════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ══════════════════════════════════════════════════════════════════════════

  function init(firebaseDb) {
    _db      = firebaseDb;
    _baseRef = _db.ref('summerCamp2026');
    _listenCertificates();
    _listenSettings();
    _bindSubNav();
    console.log('[SummerCamp] Module initialized ✅');
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  FIREBASE LISTENERS
  // ══════════════════════════════════════════════════════════════════════════

  function _listenCertificates() {
    _baseRef.child('certificates').on('value', snap => {
      _allCerts = snap.val() || {};
      _refreshCurrentView();
    });
  }

  function _listenSettings() {
    _baseRef.child('settings').on('value', snap => {
      if (snap.val()) Object.assign(_settings, snap.val());
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  NAVIGATION
  // ══════════════════════════════════════════════════════════════════════════

  function _bindSubNav() {
    document.querySelectorAll('[data-sc-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        _currentSubSection = btn.dataset.scNav;
        document.querySelectorAll('[data-sc-nav]').forEach(b =>
          b.classList.remove('sc-nav-active'));
        btn.classList.add('sc-nav-active');
        _renderSubSection(_currentSubSection);
      });
    });
  }

  function _refreshCurrentView() {
    const section = document.getElementById(_currentSubSection);
    if (section && section.closest('#section-summer-camp')) {
      _renderSubSection(_currentSubSection);
    }
  }

  function _renderSubSection(id) {
    // Hide all sub-sections
    document.querySelectorAll('.sc-subsection').forEach(s =>
      s.classList.add('sc-hidden'));
    const target = document.getElementById(id);
    if (!target) return;
    target.classList.remove('sc-hidden');

    switch (id) {
      case 'sc-dashboard':    _renderDashboard();   break;
      case 'sc-students':     _renderStudents();    break;
      case 'sc-generate':     _renderGenerate();    break;
      case 'sc-bulk':         _renderBulk();        break;
      case 'sc-records':      _renderRecords();     break;
      case 'sc-verify-panel': _renderVerifyPanel(); break;
      case 'sc-settings':     _renderSettings();    break;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  CERTIFICATE ID GENERATOR
  //  Format: MFLB-2026-SC-0001
  // ══════════════════════════════════════════════════════════════════════════

  async function _nextCertNumber() {
    const ref = _baseRef.child('settings/counter');
    return new Promise((resolve, reject) => {
      ref.transaction(current => {
        return (current || 0) + 1;
      }, (err, committed, snap) => {
        if (err) reject(err);
        else resolve(snap.val());
      });
    });
  }

  function _formatCertId(n) {
    return `MFLB-2026-SC-${String(n).padStart(4, '0')}`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  VERIFICATION HASH
  // ══════════════════════════════════════════════════════════════════════════

  async function _makeHash(certId, studentName, issueDate) {
    const msg    = `${certId}|${studentName}|${issueDate}`;
    const buf    = await crypto.subtle.digest(
      'SHA-256', new TextEncoder().encode(msg));
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16).toUpperCase();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  HIJRI DATE CONVERTER  (Umm al-Qura approximate)
  // ══════════════════════════════════════════════════════════════════════════

  function _toHijri(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    try {
      return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
        day: 'numeric', month: 'long', year: 'numeric'
      }).format(d);
    } catch { return ''; }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SAVE CERTIFICATE TO FIREBASE
  // ══════════════════════════════════════════════════════════════════════════

  async function _saveCertificate(data) {
    const n      = await _nextCertNumber();
    const certId = _formatCertId(n);
    const today  = new Date().toISOString().split('T')[0];
    const hash   = await _makeHash(certId, data.studentName, today);

    const cert = {
      certId,
      certificateNumber: certId,
      studentName:   data.studentName   || '',
      relationType:  data.relationType  || 'D/O',
      parentName:    data.parentName    || '',
      programName:   data.programName   || _settings.programName,
      startDate:     data.startDate     || _settings.startDate,
      endDate:       data.endDate       || _settings.endDate,
      grade:         data.grade         || 'ممتاز',
      status:        'active',
      issueDate:     today,
      hijriDate:     _toHijri(today),
      verificationHash: hash,
      qrData:        `${certId}|${hash}`,
      createdAt:     Date.now(),
      updatedAt:     Date.now()
    };

    const key = certId.replace(/-/g, '_');
    await _baseRef.child(`certificates/${key}`).set(cert);
    return cert;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  QR CODE RENDERER (pure SVG — no external lib needed)
  //  Uses qrcode-svg approach embedded inline
  // ══════════════════════════════════════════════════════════════════════════

  function _qrSvg(text, size = 120) {
    // Simple QR-like visual placeholder with encoded data
    // For production: swap with qrcode.js CDN call
    const safeText = encodeURIComponent(text);
    return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="white"/>
      <image href="https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${safeText}&color=1a2744&bgcolor=ffffff"
             width="${size}" height="${size}" onerror="this.style.display='none'"/>
      <text x="${size/2}" y="${size-4}" text-anchor="middle" font-size="6" fill="#888">
        ${text.slice(0,20)}
      </text>
    </svg>`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  CERTIFICATE RENDERER  —  the heart of the system
  //  Returns an HTMLElement (not a string) for live preview + printing
  // ══════════════════════════════════════════════════════════════════════════

  function _buildCertificateElement(cert) {
    const el = document.createElement('div');
    el.className = 'sc-cert-paper';
    el.setAttribute('data-cert-id', cert.certId);

    // ── Islamic geometric corner SVGs ──────────────────────────────────────
    const cornerSVG = (flip = false) => `
      <svg class="sc-cert-corner ${flip ? 'sc-flip' : ''}"
           viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,0 L80,0 L80,8 L8,8 L8,80 L0,80 Z"
              fill="none" stroke="#c9a84c" stroke-width="1.5"/>
        <path d="M12,0 L12,12 L0,12" fill="none" stroke="#c9a84c" stroke-width="1"/>
        <circle cx="12" cy="12" r="3" fill="#c9a84c" opacity="0.6"/>
        <path d="M0,20 Q6,26 12,20 Q18,14 24,20 Q30,26 36,20"
              fill="none" stroke="#c9a84c" stroke-width="0.8" opacity="0.5"/>
        <path d="M20,0 Q26,6 20,12 Q14,18 20,24 Q26,30 20,36"
              fill="none" stroke="#c9a84c" stroke-width="0.8" opacity="0.5"/>
      </svg>`;

    const arabesque = `
      <svg class="sc-cert-arabesque" viewBox="0 0 400 30"
           xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="ara" x="0" y="0" width="40" height="30" patternUnits="userSpaceOnUse">
            <path d="M0,15 Q10,0 20,15 Q30,30 40,15" fill="none"
                  stroke="#c9a84c" stroke-width="0.8" opacity="0.6"/>
            <path d="M0,15 Q10,30 20,15 Q30,0 40,15" fill="none"
                  stroke="#8b6914" stroke-width="0.5" opacity="0.4"/>
            <circle cx="20" cy="15" r="2" fill="#c9a84c" opacity="0.4"/>
          </pattern>
        </defs>
        <rect width="400" height="30" fill="url(#ara)"/>
      </svg>`;

    const starGeometry = `
      <svg class="sc-cert-star" viewBox="0 0 60 60"
           xmlns="http://www.w3.org/2000/svg">
        <polygon points="30,2 36,22 58,22 40,34 47,54 30,42 13,54 20,34 2,22 24,22"
                 fill="none" stroke="#c9a84c" stroke-width="1" opacity="0.5"/>
        <polygon points="30,10 34,20 46,20 36,28 40,40 30,32 20,40 24,28 14,20 26,20"
                 fill="#c9a84c" opacity="0.15"/>
      </svg>`;

    const seal = `
      <div class="sc-cert-seal">
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="80" height="80">
          <circle cx="50" cy="50" r="46" fill="none" stroke="#c9a84c" stroke-width="2"/>
          <circle cx="50" cy="50" r="40" fill="none" stroke="#c9a84c" stroke-width="0.5"/>
          <polygon points="50,14 55,30 70,30 58,40 63,56 50,46 37,56 42,40 30,30 45,30"
                   fill="#c9a84c" opacity="0.3" stroke="#c9a84c" stroke-width="0.5"/>
          <text x="50" y="68" text-anchor="middle" font-family="serif"
                font-size="6" fill="#8b6914" letter-spacing="0.5">MAKTAB FATIMAH</text>
          <text x="50" y="78" text-anchor="middle" font-family="serif"
                font-size="5" fill="#8b6914">LIL BANAT ✦ KHAMMAM</text>
        </svg>
      </div>`;

    el.innerHTML = `
      <!-- Background watermark geometry -->
      <div class="sc-cert-watermark">
        <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg"
             width="300" height="300">
          <circle cx="150" cy="150" r="140" fill="none"
                  stroke="#c9a84c" stroke-width="0.3" opacity="0.08"/>
          <circle cx="150" cy="150" r="110" fill="none"
                  stroke="#c9a84c" stroke-width="0.3" opacity="0.06"/>
          <polygon points="150,10 175,75 245,75 190,117 212,185 150,143 88,185 110,117 55,75 125,75"
                   fill="none" stroke="#c9a84c" stroke-width="0.5" opacity="0.07"/>
          <polygon points="150,40 168,95 226,95 180,127 197,184 150,150 103,184 120,127 74,95 132,95"
                   fill="none" stroke="#c9a84c" stroke-width="0.3" opacity="0.05"/>
        </svg>
      </div>

      <!-- Corners -->
      ${cornerSVG(false)}
      ${cornerSVG(true)}
      <div class="sc-cert-corner-bl">${cornerSVG(false)}</div>
      <div class="sc-cert-corner-br">${cornerSVG(true)}</div>

      <!-- Header -->
      <div class="sc-cert-header">
        <div class="sc-cert-logo-wrap">
          <img src="assets/logo.png" class="sc-cert-logo" alt="لوگو"
               onerror="this.style.display='none'"/>
        </div>
        <div class="sc-cert-headings">
          <div class="sc-cert-bismillah">بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيمِ</div>
          <div class="sc-cert-inst-ar">مَكْتَبُ فَاطِمَةَ لِلْبَنَاتِ</div>
          <div class="sc-cert-inst-en">MAKTAB FATIMAH LIL BANAT</div>
          <div class="sc-cert-inst-addr">
            اندرون قلعہ، مقابل مسجد نمرہ، کھمم، تلنگانہ
          </div>
        </div>
      </div>

      ${arabesque}

      <!-- Certificate Title -->
      <div class="sc-cert-title-band">
        <div class="sc-cert-star-l">${starGeometry}</div>
        <div class="sc-cert-title-text">
          <span class="sc-cert-title-ar">شَهَادَةُ التَّقْدِيرِ</span>
          <span class="sc-cert-title-en">CERTIFICATE OF APPRECIATION</span>
        </div>
        <div class="sc-cert-star-r">${starGeometry}</div>
      </div>

      <!-- Presented to -->
      <div class="sc-cert-presented">يُقَدَّمُ هٰذَا إِلٰى</div>
      <div class="sc-cert-presented-ur">یہ سند پیش کی جاتی ہے</div>

      <!-- Student Name -->
      <div class="sc-cert-student-name">${cert.studentName}</div>
      <div class="sc-cert-relation">
        ${cert.relationType || 'D/O'} ${cert.parentName}
      </div>

      <!-- Body Text -->
      <div class="sc-cert-body-text">
        بہ خاطرِ شرکت و کامیاب تکمیل
        <span class="sc-cert-program">${cert.programName}</span>
        <br/>
        مؤرخہ <span class="sc-cert-date">${cert.startDate}</span>
        تا <span class="sc-cert-date">${cert.endDate}</span>
        <br/>
        بنیادِ دین، تلاوتِ قرآن، اور تعلیمِ اخلاق میں
      </div>

      ${arabesque}

      <!-- Grade Badge -->
      <div class="sc-cert-grade-wrap">
        <div class="sc-cert-grade-badge">
          <div class="sc-cert-grade-label">درجہ</div>
          <div class="sc-cert-grade-value">${cert.grade}</div>
          <div class="sc-cert-grade-label">GRADE</div>
        </div>
      </div>

      <!-- Footer: Signatures + Dates + QR + Seal -->
      <div class="sc-cert-footer">
        <div class="sc-cert-sig-col">
          <div class="sc-cert-sig-line"></div>
          <div class="sc-cert-sig-name">${_settings.directorName}</div>
          <div class="sc-cert-sig-title">مدیرہ / Director</div>
        </div>

        <div class="sc-cert-footer-center">
          ${seal}
          <div class="sc-cert-issue-info">
            <div class="sc-cert-issue-date">${cert.issueDate}</div>
            <div class="sc-cert-issue-hijri">${cert.hijriDate}</div>
            <div class="sc-cert-cert-id">${cert.certId}</div>
          </div>
        </div>

        <div class="sc-cert-qr-col">
          <div class="sc-cert-qr-box">
            ${_qrSvg(cert.qrData, 80)}
          </div>
          <div class="sc-cert-qr-label">تصدیق کریں</div>
          <div class="sc-cert-qr-label" style="font-size:7px">
            ${cert.certId}
          </div>
        </div>
      </div>

      <!-- Revoked Overlay -->
      ${cert.status === 'revoked' ? `
        <div class="sc-cert-revoked-overlay">
          <span>منسوخ — REVOKED</span>
        </div>` : ''}
    `;
    return el;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  DASHBOARD
  // ══════════════════════════════════════════════════════════════════════════

  function _renderDashboard() {
    const certs  = Object.values(_allCerts);
    const total  = certs.length;
    const active = certs.filter(c => c.status === 'active').length;
    const revoked= certs.filter(c => c.status === 'revoked').length;
    const today  = new Date().toISOString().split('T')[0];
    const todayN = certs.filter(c => c.issueDate === today).length;
    const recent = [...certs].sort((a,b) => b.createdAt - a.createdAt).slice(0,6);

    const el = document.getElementById('sc-dashboard');
    el.innerHTML = `
      <h2 class="sc-section-title">🏅 سمر کیمپ ۲۰۲۶ — ڈیش بورڈ</h2>

      <div class="sc-stat-grid">
        <div class="sc-stat-card sc-stat-blue">
          <div class="sc-stat-icon">🏅</div>
          <div class="sc-stat-num">${total}</div>
          <div class="sc-stat-lbl">کل سندیں</div>
        </div>
        <div class="sc-stat-card sc-stat-green">
          <div class="sc-stat-icon">✅</div>
          <div class="sc-stat-num">${active}</div>
          <div class="sc-stat-lbl">فعال</div>
        </div>
        <div class="sc-stat-card sc-stat-red">
          <div class="sc-stat-icon">🚫</div>
          <div class="sc-stat-num">${revoked}</div>
          <div class="sc-stat-lbl">منسوخ</div>
        </div>
        <div class="sc-stat-card sc-stat-gold">
          <div class="sc-stat-icon">📅</div>
          <div class="sc-stat-num">${todayN}</div>
          <div class="sc-stat-lbl">آج جاری</div>
        </div>
      </div>

      <div class="sc-card sc-mt">
        <div class="sc-card-title">🕐 حالیہ سندیں</div>
        ${recent.length ? `
          <div class="sc-table-wrap">
            <table class="sc-table">
              <thead><tr>
                <th>سند نمبر</th><th>طالبہ</th><th>تاریخ</th>
                <th>گریڈ</th><th>حالت</th><th>عمل</th>
              </tr></thead>
              <tbody>
                ${recent.map(c => `
                  <tr>
                    <td><code class="sc-cert-code">${c.certId}</code></td>
                    <td>${c.studentName}<br/>
                      <small style="opacity:.6">${c.relationType} ${c.parentName}</small>
                    </td>
                    <td>${c.issueDate}</td>
                    <td><span class="sc-badge sc-badge-gold">${c.grade}</span></td>
                    <td><span class="sc-badge ${c.status==='active'?'sc-badge-green':'sc-badge-red'}">
                      ${c.status==='active'?'فعال':'منسوخ'}
                    </span></td>
                    <td class="sc-action-cell">
                      <button class="sc-btn sc-btn-sm sc-btn-outline"
                        onclick="SummerCamp.previewCert('${c.certId}')">👁️</button>
                      <button class="sc-btn sc-btn-sm sc-btn-outline"
                        onclick="SummerCamp.printCert('${c.certId}')">🖨️</button>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>` : `<p class="sc-empty">ابھی کوئی سند جاری نہیں ہوئی۔</p>`}
      </div>
    `;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  STUDENTS LIST (pulled from summerCamp2026/certificates)
  // ══════════════════════════════════════════════════════════════════════════

  function _renderStudents() {
    const el    = document.getElementById('sc-students');
    const certs = Object.values(_allCerts);

    el.innerHTML = `
      <h2 class="sc-section-title">👩‍🎓 طالبات — سمر کیمپ ۲۰۲۶</h2>
      <div class="sc-toolbar">
        <input type="text" id="sc-student-search" class="sc-input"
               placeholder="🔍 نام یا سند نمبر سے تلاش…"
               oninput="SummerCamp._filterStudents(this.value)"/>
        <button class="sc-btn sc-btn-primary"
          onclick="SummerCamp._gotoGenerate()">➕ نئی سند</button>
      </div>
      <div class="sc-table-wrap">
        <table class="sc-table" id="sc-students-table">
          <thead><tr>
            <th>#</th><th>سند نمبر</th><th>نام</th>
            <th>نسبت</th><th>پروگرام</th>
            <th>تاریخ اجرا</th><th>گریڈ</th><th>حالت</th><th>عمل</th>
          </tr></thead>
          <tbody id="sc-students-tbody">
            ${_buildStudentRows(certs)}
          </tbody>
        </table>
      </div>
    `;
  }

  function _buildStudentRows(certs) {
    if (!certs.length) return `<tr><td colspan="9" class="sc-empty">کوئی ریکارڈ نہیں۔</td></tr>`;
    return certs.map((c, i) => `
      <tr>
        <td>${i+1}</td>
        <td><code class="sc-cert-code">${c.certId}</code></td>
        <td><strong>${c.studentName}</strong></td>
        <td>${c.relationType} ${c.parentName}</td>
        <td>${c.programName}</td>
        <td>${c.issueDate}</td>
        <td><span class="sc-badge sc-badge-gold">${c.grade}</span></td>
        <td><span class="sc-badge ${c.status==='active'?'sc-badge-green':'sc-badge-red'}">
          ${c.status==='active'?'فعال':'منسوخ'}
        </span></td>
        <td class="sc-action-cell">
          <button class="sc-btn sc-btn-sm sc-btn-outline"
            onclick="SummerCamp.previewCert('${c.certId}')">👁️</button>
          <button class="sc-btn sc-btn-sm sc-btn-outline"
            onclick="SummerCamp.printCert('${c.certId}')">🖨️</button>
          ${c.status==='active'
            ? `<button class="sc-btn sc-btn-sm sc-btn-danger"
                onclick="SummerCamp.revokeCert('${c.certId}')">🚫</button>`
            : `<button class="sc-btn sc-btn-sm sc-btn-success"
                onclick="SummerCamp.restoreCert('${c.certId}')">✅</button>`}
        </td>
      </tr>`).join('');
  }

  function _filterStudents(query) {
    const certs = Object.values(_allCerts).filter(c =>
      c.studentName?.toLowerCase().includes(query.toLowerCase()) ||
      c.certId?.toLowerCase().includes(query.toLowerCase()) ||
      c.parentName?.toLowerCase().includes(query.toLowerCase())
    );
    const tbody = document.getElementById('sc-students-tbody');
    if (tbody) tbody.innerHTML = _buildStudentRows(certs);
  }

  function _gotoGenerate() {
    document.querySelector('[data-sc-nav="sc-generate"]')?.click();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  GENERATE SINGLE CERTIFICATE
  // ══════════════════════════════════════════════════════════════════════════

  function _renderGenerate() {
    const el = document.getElementById('sc-generate');
    el.innerHTML = `
      <h2 class="sc-section-title">📜 سند جاری کریں</h2>
      <div class="sc-form-grid">
        <div class="sc-form-col">
          <div class="sc-card">
            <div class="sc-card-title">طالبہ کی معلومات</div>
            <div class="sc-form-group">
              <label class="sc-label">طالبہ کا نام *</label>
              <input id="sc-g-name" class="sc-input" type="text"
                     placeholder="مثلاً: فاطمہ بنت عبداللہ"/>
            </div>
            <div class="sc-form-row">
              <div class="sc-form-group">
                <label class="sc-label">نسبت</label>
                <select id="sc-g-rel" class="sc-input">
                  <option value="D/O">D/O (بنتِ)</option>
                  <option value="W/O">W/O (زوجۂ)</option>
                  <option value="S/O">S/O (ابنِ)</option>
                </select>
              </div>
              <div class="sc-form-group">
                <label class="sc-label">والد / شوہر کا نام *</label>
                <input id="sc-g-parent" class="sc-input" type="text"
                       placeholder="والد کا نام"/>
              </div>
            </div>
            <div class="sc-form-group">
              <label class="sc-label">پروگرام کا نام</label>
              <input id="sc-g-prog" class="sc-input" type="text"
                     value="${_settings.programName}"/>
            </div>
            <div class="sc-form-row">
              <div class="sc-form-group">
                <label class="sc-label">شروع تاریخ</label>
                <input id="sc-g-start" class="sc-input" type="date"
                       value="${_settings.startDate}"/>
              </div>
              <div class="sc-form-group">
                <label class="sc-label">ختم تاریخ</label>
                <input id="sc-g-end" class="sc-input" type="date"
                       value="${_settings.endDate}"/>
              </div>
            </div>
            <div class="sc-form-group">
              <label class="sc-label">گریڈ / درجہ</label>
              <select id="sc-g-grade" class="sc-input">
                <option>ممتاز</option>
                <option>بہترین</option>
                <option>اچھا</option>
                <option>اوسط</option>
              </select>
            </div>
            <div class="sc-form-actions">
              <button class="sc-btn sc-btn-primary sc-btn-lg"
                id="sc-gen-btn"
                onclick="SummerCamp._generateCert()">
                📜 سند جاری کریں
              </button>
            </div>
          </div>
        </div>

        <div class="sc-form-col">
          <div class="sc-card">
            <div class="sc-card-title">پیش نظارہ</div>
            <div id="sc-gen-preview" class="sc-cert-preview-wrap">
              <div class="sc-preview-placeholder">
                <div style="font-size:3rem">📜</div>
                <div>معلومات درج کریں، سند خودبخود بنے گی</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async function _generateCert() {
    const name   = document.getElementById('sc-g-name')?.value?.trim();
    const rel    = document.getElementById('sc-g-rel')?.value;
    const parent = document.getElementById('sc-g-parent')?.value?.trim();
    const prog   = document.getElementById('sc-g-prog')?.value?.trim();
    const start  = document.getElementById('sc-g-start')?.value;
    const end    = document.getElementById('sc-g-end')?.value;
    const grade  = document.getElementById('sc-g-grade')?.value;

    if (!name || !parent) {
      _toast('طالبہ کا نام اور والد کا نام لازمی ہیں۔', 'error'); return;
    }

    const btn = document.getElementById('sc-gen-btn');
    btn.disabled = true; btn.textContent = '⏳ جاری ہو رہی ہے…';

    try {
      const cert = await _saveCertificate({ studentName:name, relationType:rel,
        parentName:parent, programName:prog, startDate:start, endDate:end, grade });
      _toast(`سند جاری ہوئی — ${cert.certId} ✅`, 'success');

      // Show preview
      const preview = document.getElementById('sc-gen-preview');
      if (preview) {
        preview.innerHTML = '';
        preview.appendChild(_buildCertificateElement(cert));
        const actions = document.createElement('div');
        actions.className = 'sc-cert-preview-actions';
        actions.innerHTML = `
          <button class="sc-btn sc-btn-primary"
            onclick="SummerCamp.printCert('${cert.certId}')">🖨️ پرنٹ کریں</button>
          <button class="sc-btn sc-btn-outline"
            onclick="SummerCamp._generateCert_Reset()">➕ نئی سند</button>`;
        preview.appendChild(actions);
      }
    } catch(e) {
      _toast('خرابی: ' + e.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = '📜 سند جاری کریں';
    }
  }

  function _generateCert_Reset() {
    document.getElementById('sc-g-name').value = '';
    document.getElementById('sc-g-parent').value = '';
    const preview = document.getElementById('sc-gen-preview');
    if (preview) preview.innerHTML = `<div class="sc-preview-placeholder">
      <div style="font-size:3rem">📜</div>
      <div>معلومات درج کریں، سند خودبخود بنے گی</div></div>`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  BULK EXCEL IMPORT
  // ══════════════════════════════════════════════════════════════════════════

  function _renderBulk() {
    const el = document.getElementById('sc-bulk');
    el.innerHTML = `
      <h2 class="sc-section-title">📥 بلک اندراج (Excel)</h2>
      <div class="sc-card">
        <div class="sc-card-title">Excel/CSV فائل سے سندیں بنائیں</div>
        <div class="sc-bulk-info">
          <strong>فائل فارمیٹ (CSV):</strong><br/>
          <code>studentName, relationType, parentName, grade, programName, startDate, endDate</code>
          <br/><br/>
          <strong>مثال:</strong><br/>
          <code>فاطمہ بنت احمد, D/O, احمد علی, ممتاز, سمر کیمپ ۲۰۲۶, 2026-06-01, 2026-06-30</code>
        </div>
        <div class="sc-form-group sc-mt">
          <label class="sc-label">CSV یا Excel فائل منتخب کریں</label>
          <input type="file" id="sc-bulk-file" class="sc-input"
                 accept=".csv,.xlsx,.xls"
                 onchange="SummerCamp._previewBulk(this)"/>
        </div>
        <div id="sc-bulk-preview" class="sc-bulk-preview-wrap"></div>
        <div class="sc-form-actions" id="sc-bulk-actions" style="display:none">
          <button class="sc-btn sc-btn-primary sc-btn-lg"
            id="sc-bulk-go-btn"
            onclick="SummerCamp._processBulk()">
            ⚡ تمام سندیں جاری کریں
          </button>
        </div>
        <div id="sc-bulk-progress" class="sc-bulk-progress-wrap"></div>
      </div>
    `;
  }

  let _bulkRows = [];

  function _previewBulk(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      _bulkRows = _parseCSV(text);
      const preview = document.getElementById('sc-bulk-preview');
      const actions = document.getElementById('sc-bulk-actions');
      if (!_bulkRows.length) {
        preview.innerHTML = '<p class="sc-error">فائل میں کوئی ڈیٹا نہیں ملا۔</p>';
        return;
      }
      preview.innerHTML = `
        <div class="sc-bulk-count">✅ ${_bulkRows.length} طالبات ملیں</div>
        <div class="sc-table-wrap">
          <table class="sc-table">
            <thead><tr>
              <th>#</th><th>نام</th><th>نسبت</th>
              <th>والد</th><th>گریڈ</th>
            </tr></thead>
            <tbody>
              ${_bulkRows.slice(0,10).map((r,i) => `
                <tr>
                  <td>${i+1}</td>
                  <td>${r.studentName||'—'}</td>
                  <td>${r.relationType||'D/O'}</td>
                  <td>${r.parentName||'—'}</td>
                  <td>${r.grade||'ممتاز'}</td>
                </tr>`).join('')}
              ${_bulkRows.length > 10
                ? `<tr><td colspan="5" class="sc-empty">
                    … اور ${_bulkRows.length - 10} مزید
                   </td></tr>` : ''}
            </tbody>
          </table>
        </div>`;
      actions.style.display = 'block';
    };
    reader.readAsText(file, 'UTF-8');
  }

  function _parseCSV(text) {
    const lines = text.trim().split('\n').filter(l => l.trim());
    // Skip header if first row contains "studentName" or "نام"
    const start = (lines[0].includes('studentName') || lines[0].includes('نام')) ? 1 : 0;
    return lines.slice(start).map(line => {
      const [studentName='', relationType='D/O', parentName='',
             grade='ممتاز', programName='', startDate='', endDate=''] =
        line.split(',').map(s => s.trim());
      return { studentName, relationType, parentName, grade,
               programName: programName || _settings.programName,
               startDate: startDate || _settings.startDate,
               endDate:   endDate   || _settings.endDate };
    }).filter(r => r.studentName);
  }

  async function _processBulk() {
    if (!_bulkRows.length) return;
    const btn      = document.getElementById('sc-bulk-go-btn');
    const progress = document.getElementById('sc-bulk-progress');
    btn.disabled   = true;
    let done = 0, errors = 0;

    progress.innerHTML = `<div class="sc-progress-bar-wrap">
      <div class="sc-progress-bar" id="sc-prog-bar" style="width:0%"></div>
    </div><div id="sc-prog-text">شروع ہو رہا ہے…</div>`;

    for (const row of _bulkRows) {
      try {
        await _saveCertificate(row);
        done++;
      } catch(e) { errors++; }

      const pct = Math.round(((done + errors) / _bulkRows.length) * 100);
      document.getElementById('sc-prog-bar').style.width = pct + '%';
      document.getElementById('sc-prog-text').textContent =
        `${done + errors} / ${_bulkRows.length} — ${done} کامیاب، ${errors} ناکام`;
      // Small delay to let UI breathe
      await new Promise(r => setTimeout(r, 80));
    }

    progress.innerHTML += `<div class="sc-bulk-result">
      ✅ ${done} سندیں جاری ہوئیں
      ${errors ? `⚠️ ${errors} ناکام` : ''}
    </div>`;
    btn.disabled = false;
    _toast(`${done} سندیں کامیابی سے جاری ہوئیں۔`, 'success');
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  CERTIFICATE RECORDS
  // ══════════════════════════════════════════════════════════════════════════

  function _renderRecords() {
    const el    = document.getElementById('sc-records');
    const certs = Object.values(_allCerts)
      .sort((a,b) => b.createdAt - a.createdAt);

    el.innerHTML = `
      <h2 class="sc-section-title">📋 سند ریکارڈز</h2>
      <div class="sc-toolbar">
        <input type="text" id="sc-rec-search" class="sc-input"
               placeholder="🔍 تلاش…"
               oninput="SummerCamp._filterRecords(this.value)"/>
        <select id="sc-rec-status" class="sc-input sc-input-sm"
                onchange="SummerCamp._filterRecords('')">
          <option value="">تمام</option>
          <option value="active">فعال</option>
          <option value="revoked">منسوخ</option>
        </select>
      </div>
      <div class="sc-card">
        <div class="sc-table-wrap">
          <table class="sc-table">
            <thead><tr>
              <th>سند نمبر</th><th>طالبہ</th><th>پروگرام</th>
              <th>تاریخ اجرا</th><th>گریڈ</th><th>حالت</th>
              <th>تصدیق ہیش</th><th>عمل</th>
            </tr></thead>
            <tbody id="sc-records-tbody">
              ${_buildRecordRows(certs)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function _buildRecordRows(certs) {
    if (!certs.length) return `<tr><td colspan="8" class="sc-empty">کوئی ریکارڈ نہیں۔</td></tr>`;
    return certs.map(c => `
      <tr>
        <td><code class="sc-cert-code">${c.certId}</code></td>
        <td>${c.studentName}<br/>
          <small style="opacity:.6">${c.relationType} ${c.parentName}</small></td>
        <td>${c.programName}</td>
        <td>${c.issueDate}</td>
        <td><span class="sc-badge sc-badge-gold">${c.grade}</span></td>
        <td><span class="sc-badge ${c.status==='active'?'sc-badge-green':'sc-badge-red'}">
          ${c.status==='active'?'فعال ✅':'منسوخ 🚫'}</span></td>
        <td><code style="font-size:10px">${c.verificationHash||'—'}</code></td>
        <td class="sc-action-cell">
          <button class="sc-btn sc-btn-sm sc-btn-outline"
            onclick="SummerCamp.previewCert('${c.certId}')">👁️</button>
          <button class="sc-btn sc-btn-sm sc-btn-outline"
            onclick="SummerCamp.printCert('${c.certId}')">🖨️</button>
          ${c.status==='active'
            ? `<button class="sc-btn sc-btn-sm sc-btn-danger"
                onclick="SummerCamp.revokeCert('${c.certId}')">🚫</button>`
            : `<button class="sc-btn sc-btn-sm sc-btn-success"
                onclick="SummerCamp.restoreCert('${c.certId}')">✅</button>`}
        </td>
      </tr>`).join('');
  }

  function _filterRecords(query) {
    const statusSel = document.getElementById('sc-rec-status');
    const statusVal = statusSel?.value || '';
    const certs = Object.values(_allCerts).filter(c =>
      (!query || c.studentName?.toLowerCase().includes(query.toLowerCase()) ||
                 c.certId?.toLowerCase().includes(query.toLowerCase())) &&
      (!statusVal || c.status === statusVal)
    ).sort((a,b) => b.createdAt - a.createdAt);

    const tbody = document.getElementById('sc-records-tbody');
    if (tbody) tbody.innerHTML = _buildRecordRows(certs);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  VERIFICATION PANEL
  // ══════════════════════════════════════════════════════════════════════════

  function _renderVerifyPanel() {
    const el = document.getElementById('sc-verify-panel');
    el.innerHTML = `
      <h2 class="sc-section-title">🔐 سند تصدیق</h2>
      <div class="sc-card sc-verify-card">
        <div class="sc-card-title">سند کی تصدیق کریں</div>
        <div class="sc-form-group">
          <label class="sc-label">سند نمبر یا QR ڈیٹا</label>
          <div class="sc-input-row">
            <input type="text" id="sc-verify-input" class="sc-input"
                   placeholder="MFLB-2026-SC-0001"
                   onkeydown="if(event.key==='Enter') SummerCamp.verifyCert()"/>
            <button class="sc-btn sc-btn-primary"
              onclick="SummerCamp.verifyCert()">🔍 تصدیق</button>
          </div>
        </div>
        <div id="sc-verify-result" class="sc-verify-result"></div>
      </div>
    `;
  }

  async function _verifyCert(query) {
    const raw = (query || document.getElementById('sc-verify-input')?.value || '').trim();
    if (!raw) { _toast('سند نمبر درج کریں۔', 'error'); return; }

    // Extract cert ID from QR data  (format: CERTID|HASH)
    const certId = raw.includes('|') ? raw.split('|')[0] : raw;
    const key    = certId.replace(/-/g, '_');
    const result = document.getElementById('sc-verify-result');

    const cert = _allCerts[key];
    if (!cert) {
      result.innerHTML = `
        <div class="sc-verify-invalid">
          <div class="sc-verify-icon">❌</div>
          <div class="sc-verify-status-text">سند نہیں ملی</div>
          <div>نمبر <strong>${certId}</strong> ہمارے ریکارڈ میں موجود نہیں۔</div>
        </div>`;
      return;
    }

    // Verify hash if QR data provided
    let hashValid = true;
    if (raw.includes('|')) {
      const inputHash = raw.split('|')[1];
      const calcHash  = await _makeHash(cert.certId, cert.studentName, cert.issueDate);
      hashValid = inputHash === calcHash;
    }

    const isActive = cert.status === 'active' && hashValid;
    result.innerHTML = `
      <div class="sc-verify-${isActive ? 'valid' : 'invalid'}">
        <div class="sc-verify-icon">${isActive ? '✅' : '🚫'}</div>
        <div class="sc-verify-status-text">
          ${isActive ? 'سند درست اور قابلِ اعتبار ہے' :
            cert.status === 'revoked' ? 'یہ سند منسوخ کر دی گئی ہے' : 'سند غیر تصدیق شدہ'}
        </div>
        <table class="sc-verify-table">
          <tr><td>سند نمبر</td><td><code>${cert.certId}</code></td></tr>
          <tr><td>طالبہ</td><td><strong>${cert.studentName}</strong></td></tr>
          <tr><td>نسبت</td><td>${cert.relationType} ${cert.parentName}</td></tr>
          <tr><td>پروگرام</td><td>${cert.programName}</td></tr>
          <tr><td>مدت</td><td>${cert.startDate} — ${cert.endDate}</td></tr>
          <tr><td>تاریخ اجرا</td><td>${cert.issueDate}</td></tr>
          <tr><td>تاریخ ہجری</td><td>${cert.hijriDate||'—'}</td></tr>
          <tr><td>گریڈ</td><td><span class="sc-badge sc-badge-gold">${cert.grade}</span></td></tr>
          <tr><td>تصدیق ہیش</td><td><code>${cert.verificationHash}</code></td></tr>
          <tr><td>حالت</td>
            <td><span class="sc-badge ${cert.status==='active'?'sc-badge-green':'sc-badge-red'}">
              ${cert.status==='active'?'فعال':'منسوخ'}
            </span></td>
          </tr>
          <tr><td>جاری کردہ</td>
            <td>مَكْتَبُ فَاطِمَةَ لِلْبَنَاتِ، کھمم، تلنگانہ</td>
          </tr>
        </table>
        ${isActive ? `<button class="sc-btn sc-btn-outline sc-mt"
          onclick="SummerCamp.printCert('${cert.certId}')">🖨️ سند پرنٹ کریں</button>` : ''}
      </div>`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SETTINGS
  // ══════════════════════════════════════════════════════════════════════════

  function _renderSettings() {
    const el = document.getElementById('sc-settings');
    el.innerHTML = `
      <h2 class="sc-section-title">⚙️ سیٹنگز — سمر کیمپ ۲۰۲۶</h2>
      <div class="sc-card">
        <div class="sc-card-title">پروگرام کی تفصیلات</div>
        <div class="sc-form-group">
          <label class="sc-label">پروگرام کا نام</label>
          <input id="sc-set-prog" class="sc-input" type="text"
                 value="${_settings.programName}"/>
        </div>
        <div class="sc-form-row">
          <div class="sc-form-group">
            <label class="sc-label">شروع تاریخ</label>
            <input id="sc-set-start" class="sc-input" type="date"
                   value="${_settings.startDate}"/>
          </div>
          <div class="sc-form-group">
            <label class="sc-label">ختم تاریخ</label>
            <input id="sc-set-end" class="sc-input" type="date"
                   value="${_settings.endDate}"/>
          </div>
        </div>
        <div class="sc-form-group">
          <label class="sc-label">ڈائریکٹر / مدیرہ کا نام (دستخط)</label>
          <input id="sc-set-dir" class="sc-input" type="text"
                 value="${_settings.directorName}"/>
        </div>
        <div class="sc-form-group">
          <label class="sc-label">پرنسپل کا نام (دستخط)</label>
          <input id="sc-set-prin" class="sc-input" type="text"
                 value="${_settings.principalName}"/>
        </div>
        <div class="sc-form-actions">
          <button class="sc-btn sc-btn-primary"
            onclick="SummerCamp._saveSettings()">💾 سیٹنگز محفوظ کریں</button>
        </div>
      </div>

      <div class="sc-card sc-mt sc-danger-zone">
        <div class="sc-card-title" style="color:#e74c3c">⚠️ خطرناک زون</div>
        <p style="opacity:.7; margin-bottom:1rem">
          تمام سمر کیمپ سندیں مستقل حذف ہو جائیں گی۔ یہ عمل واپس نہیں ہوگا۔
        </p>
        <button class="sc-btn sc-btn-danger"
          onclick="SummerCamp._deleteAllCerts()">
          🗑️ تمام سندیں حذف کریں
        </button>
      </div>
    `;
  }

  async function _saveSettings() {
    const data = {
      programName:   document.getElementById('sc-set-prog')?.value?.trim(),
      startDate:     document.getElementById('sc-set-start')?.value,
      endDate:       document.getElementById('sc-set-end')?.value,
      directorName:  document.getElementById('sc-set-dir')?.value?.trim(),
      principalName: document.getElementById('sc-set-prin')?.value?.trim()
    };
    Object.assign(_settings, data);
    await _baseRef.child('settings').update(data);
    _toast('سیٹنگز محفوظ ہوئیں ✅', 'success');
  }

  async function _deleteAllCerts() {
    if (!confirm('کیا آپ واقعی تمام سندیں حذف کرنا چاہتے ہیں؟ یہ ناقابلِ واپسی ہے۔')) return;
    if (!confirm('دوبارہ تصدیق کریں — تمام سندیں مستقل حذف ہوں گی۔')) return;
    await _baseRef.child('certificates').remove();
    _toast('تمام سندیں حذف کر دی گئیں۔', 'success');
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  REVOKE / RESTORE
  // ══════════════════════════════════════════════════════════════════════════

  async function _revokeCert(certId) {
    if (!confirm(`سند ${certId} کو منسوخ کریں؟`)) return;
    const key = certId.replace(/-/g, '_');
    await _baseRef.child(`certificates/${key}`).update(
      { status: 'revoked', updatedAt: Date.now() });
    _toast(`${certId} منسوخ ہوئی۔`, 'success');
  }

  async function _restoreCert(certId) {
    const key = certId.replace(/-/g, '_');
    await _baseRef.child(`certificates/${key}`).update(
      { status: 'active', updatedAt: Date.now() });
    _toast(`${certId} بحال ہوئی۔`, 'success');
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PREVIEW MODAL
  // ══════════════════════════════════════════════════════════════════════════

  function _previewCert(certId) {
    const key  = certId.replace(/-/g, '_');
    const cert = _allCerts[key];
    if (!cert) { _toast('سند نہیں ملی۔', 'error'); return; }

    // Create modal
    let overlay = document.getElementById('sc-cert-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sc-cert-modal';
      overlay.className = 'sc-modal-overlay';
      overlay.innerHTML = `
        <div class="sc-modal-box">
          <div class="sc-modal-header">
            <span class="sc-modal-title">📜 سند پیش نظارہ</span>
            <div class="sc-modal-actions">
              <button class="sc-btn sc-btn-primary sc-btn-sm"
                id="sc-modal-print">🖨️ پرنٹ</button>
              <button class="sc-btn sc-btn-outline sc-btn-sm"
                onclick="document.getElementById('sc-cert-modal').style.display='none'">✕</button>
            </div>
          </div>
          <div class="sc-modal-body" id="sc-modal-cert-area"></div>
        </div>`;
      document.body.appendChild(overlay);
    }

    const area = document.getElementById('sc-modal-cert-area');
    area.innerHTML = '';
    area.appendChild(_buildCertificateElement(cert));
    document.getElementById('sc-modal-print').onclick =
      () => _printCert(certId);
    overlay.style.display = 'flex';
    overlay.onclick = e => { if (e.target === overlay) overlay.style.display = 'none'; };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PRINT CERTIFICATE
  // ══════════════════════════════════════════════════════════════════════════

  function _printCert(certId) {
    const key  = certId.replace(/-/g, '_');
    const cert = _allCerts[key];
    if (!cert) { _toast('سند نہیں ملی۔', 'error'); return; }

    const certEl = _buildCertificateElement(cert);
    const win    = window.open('', '_blank', 'width=1200,height=850');
    win.document.write(`<!DOCTYPE html>
<html lang="ur" dir="rtl">
<head>
<meta charset="UTF-8"/>
<title>${cert.certId} — ${cert.studentName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: A4 landscape; margin: 8mm; }
  body { font-family: 'Noto Nastaliq Urdu', 'Amiri', serif;
         background: #fff; direction: rtl; }
  ${_getCertPrintCSS()}
</style>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" rel="stylesheet"/>
</head>
<body>
${certEl.outerHTML}
<script>
  window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 1200); };
</script>
</body>
</html>`);
    win.document.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  TOAST NOTIFICATION  (reuses existing system if available)
  // ══════════════════════════════════════════════════════════════════════════

  function _toast(msg, type = 'success') {
    // Try to reuse existing app toast
    if (window.showToast) { window.showToast(msg, type); return; }
    if (window.toast)     { window.toast(msg, type);     return; }
    // Fallback
    let t = document.getElementById('sc-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'sc-toast';
      t.style.cssText = `position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);
        padding:12px 24px;border-radius:8px;font-size:.95rem;z-index:9999;
        color:#fff;transition:opacity .3s;direction:rtl;`;
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = type === 'error' ? '#e74c3c' : '#27ae60';
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; }, 3500);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PRINT CSS — returned as string for injection into print windows
  // ══════════════════════════════════════════════════════════════════════════

  function _getCertPrintCSS() {
    return `
      .sc-cert-paper {
        width: 277mm; height: 190mm;
        position: relative; overflow: hidden;
        background: linear-gradient(135deg, #fefdf8 0%, #faf6e8 50%, #fefdf8 100%);
        border: 2px solid #c9a84c;
        page-break-inside: avoid;
        font-family: 'Amiri', 'Noto Nastaliq Urdu', serif;
        direction: rtl;
        display: flex; flex-direction: column;
      }
      .sc-cert-watermark { position:absolute;top:50%;left:50%;
        transform:translate(-50%,-50%); opacity:.04; pointer-events:none; z-index:0; }
      .sc-cert-corner { position:absolute; width:70px; height:70px; top:6px; right:6px; }
      .sc-cert-corner.sc-flip { transform:scaleX(-1); right:auto; left:6px; }
      .sc-cert-corner-bl { position:absolute; bottom:6px; right:6px; }
      .sc-cert-corner-bl svg { transform:scaleY(-1); width:70px; height:70px; }
      .sc-cert-corner-br { position:absolute; bottom:6px; left:6px; }
      .sc-cert-corner-br svg { transform:scale(-1,-1); width:70px; height:70px; }
      .sc-cert-header { display:flex; align-items:center; justify-content:center;
        gap:16px; padding:10px 80px 4px; z-index:1; position:relative; }
      .sc-cert-logo { width:70px; height:auto; }
      .sc-cert-headings { text-align:center; }
      .sc-cert-bismillah { font-family:'Amiri',serif; font-size:13px;
        color:#8b6914; margin-bottom:2px; }
      .sc-cert-inst-ar { font-family:'Amiri',serif; font-size:18px;
        font-weight:700; color:#1a2744; }
      .sc-cert-inst-en { font-size:9px; letter-spacing:2px;
        color:#1a2744; opacity:.8; }
      .sc-cert-inst-addr { font-size:8px; color:#666; margin-top:1px; }
      .sc-cert-arabesque { width:100%; height:20px; display:block; }
      .sc-cert-title-band { display:flex; align-items:center; justify-content:center;
        gap:12px; padding:6px 60px; z-index:1; }
      .sc-cert-title-text { text-align:center; }
      .sc-cert-title-ar { display:block; font-family:'Amiri',serif;
        font-size:22px; font-weight:700;
        background: linear-gradient(135deg, #8b6914, #c9a84c, #8b6914);
        -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
      .sc-cert-title-en { display:block; font-size:9px; letter-spacing:3px;
        color:#8b6914; opacity:.8; }
      .sc-cert-star, .sc-cert-star-l, .sc-cert-star-r { width:40px; height:40px; }
      .sc-cert-presented { text-align:center; font-size:11px; color:#666;
        font-family:'Amiri',serif; }
      .sc-cert-presented-ur { text-align:center; font-size:12px; color:#888; }
      .sc-cert-student-name { text-align:center; font-family:'Amiri',serif;
        font-size:26px; font-weight:700; color:#1a2744; margin:4px 0; }
      .sc-cert-relation { text-align:center; font-size:13px; color:#555;
        font-family:'Amiri',serif; }
      .sc-cert-body-text { text-align:center; font-size:11px; color:#444;
        padding:4px 80px; line-height:1.8; font-family:'Amiri',serif; }
      .sc-cert-program { font-weight:700; color:#1a2744; }
      .sc-cert-date { color:#8b6914; font-weight:600; }
      .sc-cert-grade-wrap { display:flex; justify-content:center; margin:4px 0; }
      .sc-cert-grade-badge { border:2px solid #c9a84c; border-radius:8px;
        padding:4px 20px; text-align:center; background:rgba(201,168,76,.08); }
      .sc-cert-grade-label { font-size:8px; color:#888; letter-spacing:1px; }
      .sc-cert-grade-value { font-size:16px; font-weight:700; color:#8b6914;
        font-family:'Amiri',serif; }
      .sc-cert-footer { display:flex; align-items:flex-end; justify-content:space-between;
        padding:8px 60px; margin-top:auto; }
      .sc-cert-sig-col { text-align:center; min-width:120px; }
      .sc-cert-sig-line { border-top:1px solid #c9a84c; margin-bottom:4px; width:100px; margin: 0 auto 4px; }
      .sc-cert-sig-name { font-size:10px; font-weight:700; color:#1a2744; }
      .sc-cert-sig-title { font-size:8px; color:#888; }
      .sc-cert-footer-center { text-align:center; }
      .sc-cert-seal { display:flex; justify-content:center; }
      .sc-cert-issue-info { margin-top:4px; }
      .sc-cert-issue-date { font-size:9px; color:#555; }
      .sc-cert-issue-hijri { font-size:8px; color:#888; font-family:'Amiri',serif; }
      .sc-cert-cert-id { font-size:8px; color:#8b6914; font-weight:700;
        letter-spacing:1px; margin-top:2px; }
      .sc-cert-qr-col { text-align:center; }
      .sc-cert-qr-box { display:inline-block; border:1px solid #c9a84c; padding:2px; }
      .sc-cert-qr-label { font-size:7px; color:#888; margin-top:2px; }
      .sc-cert-revoked-overlay { position:absolute; inset:0; display:flex;
        align-items:center; justify-content:center; z-index:10;
        background:rgba(255,255,255,.7); }
      .sc-cert-revoked-overlay span { font-size:36px; font-weight:900;
        color:rgba(231,76,60,.6); border:6px solid rgba(231,76,60,.5);
        padding:8px 24px; transform:rotate(-20deg); letter-spacing:4px; }
    `;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PUBLIC METHODS exposed on window.SummerCamp
  // ══════════════════════════════════════════════════════════════════════════

  return {
    init,
    previewCert:    _previewCert,
    printCert:      _printCert,
    revokeCert:     _revokeCert,
    restoreCert:    _restoreCert,
    verifyCert:     _verifyCert,
    _filterStudents,
    _filterRecords,
    _gotoGenerate,
    _generateCert,
    _generateCert_Reset,
    _previewBulk,
    _processBulk,
    _saveSettings,
    _deleteAllCerts,
    _renderSubSection
  };

})();

// Make globally accessible (matches existing app pattern)
window.SummerCamp = SummerCamp;
