// ============================================================
// ACE — MVP Affiliate Content Engine (mvp.js)
// Boots the shell, connects UI ↔ data, and runs the full pipeline.
// ============================================================
'use strict';

// ----- Configuration & Constants -----
const AFFILIATE_BASE = 'https://s.shopee.co.th';

// ----- State -----
let candidatePool = [];
let contentLibrary = [];
let publishQueue = [];
let snapImageDataUrl = null;
let lastDraft = null;
let dashboardData = {
  totalSales: 0,
  totalClicks: 0,
  totalCommission: 0,
  trendPoints: [],
};

// ----- DOM Elements (cached, initialized on DOMContentLoaded) -----
const dom = {
  quickStart: null,
  openOffers: null,
  snapProducts: null,
  confirmSnap: null,
  candidatePool: null,
  noCandidates: null,
  snapWorkflow: null,
  actorStudio: null,
  addActor: null,
  closeActorPanel: null,
  snapCategory: null,
  snapProductName: null,
  snapProductPrice: null,
  snapProductShop: null,
  productImageUpload: null,
  dropZone: null,
  contentLibrary: null,
  refreshLibrary: null,
  setActive: null,
  selectAllLib: null,
  libraryStatusFilter: null,
  libraryTableBody: null,
  libraryCount: null,
  sourceLibrary: null,
  dashboardArea: null,
  importCSV: null,
  refreshDashboard: null,
  totalSales: null,
  totalClicks: null,
  totalCommission: null,
  trendCanvas: null,
  trendCtx: null,
  toast: null,
  evidenceLog: null,
  importFixtures: null,
  addManual: null,
  snapProductBtn: null,
  productUrl: null,
  fetchProduct: null,
  linkImportStatus: null,
  linkImportPreview: null,
  linkImportImage: null,
  linkName: null,
  linkPrice: null,
  linkCommission: null,
  addLinkProduct: null,
  snapText: null,
  snapAiExtract: null,
  snapAiStatus: null,
  snapNameInput: null,
  snapPriceInput: null,
  snapCommissionInput: null,
  snapShopInput: null,
  snapRatingInput: null,
  snapSoldInput: null,
  snapPreviewImg: null,
  contentDraftPanel: null,
  contentDraftStatus: null,
  draftHook: null,
  draftScript: null,
  draftCaption: null,
  draftHashtags: null,
  copyContentDraft: null
};

function initDomElements() {
  dom.quickStart = document.getElementById('quick-start');
  dom.openOffers = document.getElementById('open-offers');
  dom.snapProducts = document.getElementById('snap-products');
  dom.confirmSnap = document.getElementById('confirm-snap');
  dom.candidatePool = document.getElementById('candidate-pool');
  dom.noCandidates = document.getElementById('no-candidates');
  dom.snapWorkflow = document.getElementById('snap-workflow');
  dom.actorStudio = document.getElementById('actor-studio');
  dom.addActor = document.getElementById('add-actor');
  dom.closeActorPanel = document.getElementById('close-actor-panel');
  dom.snapCategory = document.querySelectorAll('input[name="snap-category"]');
  dom.snapProductName = document.getElementById('snap-product-name');
  dom.snapProductPrice = document.getElementById('snap-product-price');
  dom.snapProductShop = document.getElementById('snap-product-shop');
  dom.productImageUpload = document.getElementById('product-image-upload');
  dom.dropZone = document.getElementById('drop-zone');
  dom.contentLibrary = document.getElementById('content-library');
  dom.refreshLibrary = document.getElementById('refresh-library');
  dom.setActive = document.getElementById('set-active');
  dom.selectAllLib = document.getElementById('select-all-lib');
  dom.libraryStatusFilter = document.getElementById('library-status-filter');
  dom.libraryTableBody = document.getElementById('library-table-body');
  dom.libraryCount = document.getElementById('library-count');
  dom.sourceLibrary = document.getElementById('source-library');
  dom.dashboardArea = document.getElementById('dashboard-area');
  dom.importCSV = document.getElementById('import-csv');
  dom.refreshDashboard = document.getElementById('refresh-dashboard');
  dom.totalSales = document.getElementById('total-sales');
  dom.totalClicks = document.getElementById('total-clicks');
  dom.totalCommission = document.getElementById('total-commission');
  dom.trendCanvas = document.getElementById('trend-canvas');
  dom.toast = document.getElementById('mvp-toast');
  dom.evidenceLog = document.getElementById('evidence-log');
  dom.importFixtures = document.getElementById('import-fixtures');
  dom.addManual = document.getElementById('add-manual');
  dom.snapProductBtn = document.getElementById('snap-product');
  dom.productUrl = document.getElementById('product-url');
  dom.fetchProduct = document.getElementById('fetch-product');
  dom.linkImportStatus = document.getElementById('link-import-status');
  dom.linkImportPreview = document.getElementById('link-import-preview');
  dom.linkImportImage = document.getElementById('link-import-image');
  dom.linkName = document.getElementById('link-name');
  dom.linkPrice = document.getElementById('link-price');
  dom.linkCommission = document.getElementById('link-commission');
  dom.addLinkProduct = document.getElementById('add-link-product');
  dom.snapText = document.getElementById('snap-source-text');
  dom.snapAiExtract = document.getElementById('snap-ai-extract');
  dom.snapAiStatus = document.getElementById('snap-ai-status');
  dom.snapNameInput = document.getElementById('snap-name-input');
  dom.snapPriceInput = document.getElementById('snap-price-input');
  dom.snapCommissionInput = document.getElementById('snap-commission-input');
  dom.snapShopInput = document.getElementById('snap-shop-input');
  dom.snapRatingInput = document.getElementById('snap-rating-input');
  dom.snapSoldInput = document.getElementById('snap-sold-input');
  dom.snapPreviewImg = document.querySelector('.snap-preview-area img');
  dom.contentDraftPanel = document.getElementById('content-draft-panel');
  dom.contentDraftStatus = document.getElementById('content-draft-status');
  dom.draftHook = document.getElementById('draft-hook');
  dom.draftScript = document.getElementById('draft-script');
  dom.draftCaption = document.getElementById('draft-caption');
  dom.draftHashtags = document.getElementById('draft-hashtags');
  dom.copyContentDraft = document.getElementById('copy-content-draft');
}

// ----- Offers Modal -----
function openOffersModal() {
  // Sample offers data - in a real app, this would come from an API
  const offers = [
    {
      id: 1,
      name: 'สินค้าเทคโนโลยีอิเล็กทรอนิกส์',
      platform: 'Shopee',
      affiliateLink: 'https://s.shopee.co.th/product/tech123',
      price: 199,
      image: 'https://via.placeholder.com/150',
    },
    {
      id: 2,
      name: 'ชุดเครื่องสำอาง',
      platform: 'Shopee',
      affiliateLink: 'https://s.shopee.co.th/beauty456',
      price: 299,
      image: 'https://via.placeholder.com/150',
    },
    {
      id: 3,
      name: 'อุปกรณ์ออกกำลังกาย',
      platform: 'Shopee',
      affiliateLink: 'https://s.shopee.co.th/sports789',
      price: 399,
      image: 'https://via.placeholder.com/150',
    },
    {
      id: 4,
      name: 'ของใช้บ้าน',
      platform: 'Shopee',
      affiliateLink: 'https://s.shopee.co.th/home101',
      price: 150,
      image: 'https://via.placeholder.com/150',
    },
    {
      id: 5,
      name: 'ของเล่นเด็ก',
      platform: 'Shopee',
      affiliateLink: 'https://s.shopee.co.th/toys202',
      price: 99,
      image: 'https://via.placeholder.com/150',
    },
  ];

  // Render offers in the modal
  if (dom.offersGrid) {
    if (offers.length === 0) {
      dom.noOffers.classList.remove('hidden');
    } else {
      dom.noOffers.classList.add('hidden');
    }

    let html = offers.map(offer => `
      <div class="offer-item" data-id="${offer.id}">
        <img src="${offer.image}" alt="${offer.name}" class="offer-image">
        <div class="offer-info">
          <h3 class="offer-name">${offer.name}</h3>
          <p class="offer-platform">${offer.platform}</p>
          <p class="offer-price">฿${offer.price}</p>
        </div>
        <button class="btn btn-small btn-outline select-offer">เลือก</button>
      </div>
    `).join('');

    dom.offersGrid.innerHTML = html;

    // Add select offer handlers
    dom.offersGrid.querySelectorAll('.select-offer').forEach(btn => {
      btn.addEventListener('click', () => {
        const offerId = parseInt(btn.closest('.offer-item').dataset.id, 10);
        selectOffer(offerId);
      });
    });
  }

  // Show the modal
  if (dom.offersModal) {
    dom.offersModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scroll
  }
}

function selectOffer(offerId) {
  // Find the offer in our sample data
  const offers = [
    {
      id: 1,
      name: 'สินค้าเทคโนโลยีอิเล็กทรอนิกส์',
      platform: 'Shopee',
      affiliateLink: 'https://s.shopee.co.th/product/tech123',
      price: 199,
    },
    {
      id: 2,
      name: 'ชุดเครื่องสำอาง',
      platform: 'Shopee',
      affiliateLink: 'https://s.shopee.co.th/beauty456',
      price: 299,
    },
    {
      id: 3,
      name: 'อุปกรณ์ออกกำลังกาย',
      platform: 'Shopee',
      affiliateLink: 'https://s.shopee.co.th/sports789',
      price: 399,
    },
    {
      id: 4,
      name: 'ของใช้บ้าน',
      platform: 'Shopee',
      affiliateLink: 'https://s.shopee.co.th/home101',
      price: 150,
    },
    {
      id: 5,
      name: 'ของเล่นเด็ก',
      platform: 'Shopee',
      affiliateLink: 'https://s.shopee.co.th/toys202',
      price: 99,
    },
  ];

  const offer = offers.find(o => o.id === offerId);
  if (!offer) return;

  // Create a candidate from the offer
  const newCandidate = {
    id: candidatePool.length + 1,
    name: `Candidate: ${offer.name}`,
    platform: offer.platform,
    affiliateLink: offer.affiliateLink,
    quality: 'Medium',
    status: 'DRAFT',
    views: Math.floor(100 + Math.random() * 500),
    clicks: Math.floor(views * 0.3 + Math.random() * 50),
    estimatedSale: Math.floor(clicks * 0.04 + Math.random()),
    commission: Math.floor(estimatedSale * 32 + Math.random() * 100),
    evidence: 'เพิ่มจากข้อเสนอใหม่',
  };

  // Add to candidate pool
  candidatePool.push(newCandidate);

  // Also add to content library
  contentLibrary.push({
    ...newCandidate,
    libraryId: 'off-' + newCandidate.id,
    status: 'PENDING',
    qualityScore: newCandidate.quality,
  });

  // Render updates
  renderCandidatePool();
  renderContentLibrary();

  // Hide the modal
  closeOffersModal();
  showToast('เพิ่มข้อเสนอใหม่เป็น Candidate เรียบร้อย', 'success');
}

function closeOffersModal() {
  if (dom.offersModal) {
    dom.offersModal.classList.add('hidden');
    document.body.style.overflow = ''; // Re-enable background scroll
  }
}

// ----- Event Delegation -----
function attachEventListeners() {
  // --- "+ ข้อเสนอใหม่" menu: AI picks from real data (offer text / pool / link) ---
  if (dom.quickStart) {
    dom.quickStart.addEventListener('click', toggleNewOfferMenu);
  }

  // --- Open Offers ---
  if (dom.openOffers) {
    dom.openOffers.addEventListener('click', () => openOffersModal());
  }

  // --- Snap Products ---
  if (dom.snapProducts) {
    dom.snapProducts.addEventListener('click', () => showSnapWorkflow());
  }

  // --- Confirm Snap ---
  if (dom.confirmSnap) {
    dom.confirmSnap.addEventListener('click', () => confirmSnapAndAddCandidate());
  }

  // --- Product Image Upload ---
  if (dom.productImageUpload) {
    dom.productImageUpload.addEventListener('change', handleProductImageSelect);
  }
  if (dom.dropZone) {
    dom.dropZone.addEventListener('click', () => dom.productImageUpload.click());
    dom.dropZone.addEventListener('dragover', handleDragOver);
    dom.dropZone.addEventListener('drop', handleDrop);
  }

  // --- Actor Studio ---
  if (dom.addActor) {
    dom.addActor.addEventListener('click', () => addActorRow());
  }
  if (dom.closeActorPanel) {
    dom.closeActorPanel.addEventListener('click', () => hideActorStudio());
  }

  // --- Content Library ---
  if (dom.refreshLibrary) {
    dom.refreshLibrary.addEventListener('click', () => renderContentLibrary());
  }
  if (dom.setActive) {
    dom.setActive.addEventListener('click', () => setActiveLineage());
  }
  if (dom.selectAllLib) {
    dom.selectAllLib.addEventListener('change', toggleSelectAll);
  }
  if (dom.libraryStatusFilter) {
    dom.libraryStatusFilter.addEventListener('change', filterLibraryByStatus);
  }

  // --- Research / Source Library ---
  if (dom.importFixtures) {
    dom.importFixtures.addEventListener('click', function() {
      if (!window.confirm('ล้างคลังสินค้าทั้งหมด (pool / content library / publish queue / แหล่งข้อมูล) แล้วเริ่มใหม่? การกระทำนี้ย้อนกลับไม่ได้')) return;
      clearPoolState();
      loadFixtures();
      seedSourceLibraryFromPool();
      renderStageNav();
      if (document.body.dataset.stage === 'report') renderReport();
      showToast('ล้างคลังแล้ว — เริ่มต้นใหม่จากศูนย์ (ข้อมูลจริงเท่านั้น)', 'info');
    });
  }
  if (dom.addManual) {
    dom.addManual.addEventListener('click', addManualSource);
  }

  // --- Shopee product link import ---
  if (dom.fetchProduct) {
    dom.fetchProduct.addEventListener('click', fetchProductFromLink);
  }
  if (dom.addLinkProduct) {
    dom.addLinkProduct.addEventListener('click', addLinkProductToPools);
  }
  if (dom.linkPrice) {
    dom.linkPrice.addEventListener('input', suggestCommission);
  }

  // --- Snap assistant / content draft ---
  if (dom.snapAiExtract) {
    dom.snapAiExtract.addEventListener('click', handleSnapAiExtract);
  }
  if (dom.copyContentDraft) {
    dom.copyContentDraft.addEventListener('click', copyContentDraft);
  }
  var closeDraft = document.getElementById('close-content-draft');
  if (closeDraft) {
    closeDraft.addEventListener('click', function() {
      if (dom.contentDraftPanel) dom.contentDraftPanel.classList.add('hidden');
    });
  }

  // --- Dashboard ---
  if (dom.importCSV) {
    dom.importCSV.addEventListener('click', () => importCSVHandler());
  }
  if (dom.refreshDashboard) {
    dom.refreshDashboard.addEventListener('click', () => refreshDashboard());
  }

  // --- Settings (AI Agent) + AI shortlist panel + "+ ข้อเสนอใหม่" menu ---
  bindSettingsPanel();
  bindNewOfferMenu();
  bindRightNav();
  bindPublishSchedule();
  bindSourceShortcuts();
  bindExpandToggles();
  // The revenue tools live only in the "+ ข้อเสนอใหม่" menu; the hidden file input
  // below is what that menu opens for the results import.
  var resultsInput = document.getElementById('results-csv-file');
  if (resultsInput && resultsInput.dataset.bound !== '1') {
    resultsInput.dataset.bound = '1';
    resultsInput.addEventListener('change', function() {
      handleResultsCsvFile(resultsInput.files && resultsInput.files[0]);
      resultsInput.value = '';
    });
  }
  var previewBtn = document.getElementById('render-preview-clip');
  if (previewBtn) previewBtn.addEventListener('click', renderPreviewClip);
  var presetSel = document.getElementById('clip-preset');
  if (presetSel) presetSel.addEventListener('change', function() {
    const target = ensureCandidateSettings(currentCandidate());
    if (target) { target.preset = presetSel.value; showToast('ใช้รูปแบบการผลิต: ' + getProductionPreset(presetSel.value).label, 'success'); }
  });
  var closeShortlistBtn = document.getElementById('close-ai-shortlist');
  if (closeShortlistBtn) {
    closeShortlistBtn.addEventListener('click', function() {
      var panel = document.getElementById('ai-shortlist-panel');
      if (panel) panel.classList.add('hidden');
    });
  }
}

// ----- Persistence: the pool survives page refresh (localStorage) -----

const POOL_STORAGE_KEY = 'ace.research-pool.v1';
let poolSaveTimer = null;
let poolSaveWarned = false;

// ----- Workspace profiles: isolate work per product line (ACE → 8Creator) -----
// Each profile owns its own data bucket (pool/library/queue/sources + schedule).
// Actors and Settings stay shared on purpose (connector reuse across profiles).

const PROFILE_STORAGE_KEY = 'ace.profile.v1';
let workspaceProfiles = [];
let activeProfileId = null;

function poolKeyFor(profileId) { return POOL_STORAGE_KEY + ':' + profileId; }
function scheduleKeyFor(profileId) { return RECURRING_KEY + ':' + profileId; }

function loadProfileState() {
  let data = null;
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    data = raw ? JSON.parse(raw) : null;
  } catch (error) {
    data = null;
  }
  if (data && Array.isArray(data.profiles)) {
    workspaceProfiles = data.profiles.filter(function(p) { return p && p.id && p.name; });
    if (workspaceProfiles.length) {
      activeProfileId = workspaceProfiles.some(function(p) { return p.id === data.activeId; })
        ? data.activeId
        : workspaceProfiles[0].id;
      let modeChanged = false;
      workspaceProfiles.forEach(function(p) { if (!p.mode) { p.mode = 'easy'; modeChanged = true; } });
      if (modeChanged) saveProfileState();
      return;
    }
  }
  // First run: one default profile owns everything that exists today.
  const def = { id: 'profile-' + Date.now().toString(36), name: 'Shopee Affiliate', createdAt: new Date().toISOString(), mode: 'easy' };
  workspaceProfiles = [def];
  activeProfileId = def.id;
  // Migrate: copy the legacy single-bucket data to this profile's bucket.
  // Legacy keys stay untouched as backups.
  try {
    const legacyPool = localStorage.getItem(POOL_STORAGE_KEY);
    if (legacyPool && !localStorage.getItem(poolKeyFor(def.id))) localStorage.setItem(poolKeyFor(def.id), legacyPool);
    const legacySchedule = localStorage.getItem(RECURRING_KEY);
    if (legacySchedule && !localStorage.getItem(scheduleKeyFor(def.id))) localStorage.setItem(scheduleKeyFor(def.id), legacySchedule);
  } catch (error) { /* storage full — buckets just start empty */ }
  saveProfileState();
}

function saveProfileState() {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ profiles: workspaceProfiles, activeId: activeProfileId }));
  } catch (error) {
    showToast('บันทึกโปรไฟล์ไม่สำเร็จ (พื้นที่เต็ม?)', 'warning');
  }
}

function activeProfile() {
  return workspaceProfiles.find(function(p) { return p.id === activeProfileId; }) || workspaceProfiles[0] || null;
}

// ----- Publish channels: the account handle per channel, editable in Settings -----
// Settings stay shared across profiles, like the AI keys.

const CHANNEL_STORAGE_KEY = 'ace.channels.v1';
const CHANNEL_HANDLES_DEFAULT = {
  shopee_video: 'bombindyboy1985',
  tiktok: 'bombindyboy',
  x: 'x.com/bombindyboy1985',
  facebook: 'นกรร ธนนีย์',
  youtube: '',
};
let channelHandles = {};

function loadChannelHandles() {
  channelHandles = Object.assign({}, CHANNEL_HANDLES_DEFAULT);
  try {
    const raw = localStorage.getItem(CHANNEL_STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (saved && typeof saved === 'object') {
      Object.keys(CHANNEL_HANDLES_DEFAULT).forEach(function(id) {
        if (typeof saved[id] === 'string') channelHandles[id] = saved[id];
      });
    }
  } catch (error) {
    channelHandles = Object.assign({}, CHANNEL_HANDLES_DEFAULT);
  }
}

function saveChannelHandles(next) {
  channelHandles = Object.assign({}, channelHandles, next);
  try {
    localStorage.setItem(CHANNEL_STORAGE_KEY, JSON.stringify(channelHandles));
  } catch (error) {
    showToast('บันทึกช่องทางไม่สำเร็จ (พื้นที่เต็ม?)', 'warning');
  }
}

function channelHandle(id) {
  return channelHandles[id] || '';
}

function writePoolStateNow() {
  try {
    localStorage.setItem(poolKeyFor(activeProfileId), JSON.stringify({
      saved_at: new Date().toISOString(),
      pool: candidatePool,
      library: contentLibrary,
      queue: publishQueue,
      sources: sourceItems,
    }));
  } catch (error) {
    if (!poolSaveWarned) {
      poolSaveWarned = true;
      showToast('บันทึกลง localStorage ไม่สำเร็จ (พื้นที่เต็ม?) — ข้อมูลอาจหายเมื่อ refresh', 'warning');
    }
  }
}

function flushPoolStateForSwitch() {
  if (poolSaveTimer) {
    window.clearTimeout(poolSaveTimer);
    poolSaveTimer = null;
  }
  writePoolStateNow();
}

function profileCounts() {
  const counts = {};
  workspaceProfiles.forEach(function(p) { counts[p.id] = 0; });
  try {
    workspaceProfiles.forEach(function(p) {
      let n = 0;
      const poolRaw = localStorage.getItem(poolKeyFor(p.id));
      if (poolRaw) {
        const d = JSON.parse(poolRaw);
        if (d && typeof d === 'object') {
          ['pool', 'library', 'queue', 'sources'].forEach(function(k) {
            if (Array.isArray(d[k])) n += d[k].length;
          });
        }
      }
      const sRaw = localStorage.getItem(scheduleKeyFor(p.id));
      if (sRaw) {
        const s = JSON.parse(sRaw);
        if (Array.isArray(s)) n += s.length;
      }
      counts[p.id] = n;
    });
  } catch (error) { /* keep zeros on parse errors */ }
  return counts;
}

function updateProfileUi() {
  const profile = activeProfile();
  const name = profile ? profile.name : '';
  const pillName = document.getElementById('profile-switch-name');
  if (pillName) pillName.textContent = name;
  const cardName = document.getElementById('profile-name');
  if (cardName) cardName.textContent = name;
  const pill = document.getElementById('profile-switch');
  if (pill) pill.setAttribute('aria-expanded', 'false');
  const menu = document.getElementById('profile-menu');
  if (menu) menu.classList.add('hidden');
}

function renderProfileMenu() {
  const menu = document.getElementById('profile-menu');
  if (!menu) return;
  writePoolStateNow();
  const counts = profileCounts();
  const items = workspaceProfiles.map(function(p) {
    return '<button type="button" class="profile-menu-item' + (p.id === activeProfileId ? ' is-active' : '') +
      '" data-profile-id="' + p.id + '" role="menuitem">' +
      '<span class="profile-menu-name">' + escapeHtml(p.name) + '</span>' +
      '<span class="profile-menu-count">' + counts[p.id] + '</span>' +
      '</button>';
  }).join('');
  menu.innerHTML = items +
    '<div class="profile-menu-new">' +
    '<input type="text" id="profile-new-name" maxlength="60" placeholder="ชื่อโปรไฟล์ใหม่ เช่น Anfield Insight — YouTube">' +
    '<button type="button" id="profile-create" class="chip-btn">สร้าง</button>' +
    '</div>' +
    '<div class="profile-menu-tools">' +
    '<button type="button" id="profile-rename" class="btn btn-ghost btn-sm">เปลี่ยนชื่อโปรไฟล์นี้</button>' +
    '<button type="button" id="profile-delete" class="btn btn-ghost btn-sm">ลบโปรไฟล์นี้</button>' +
    '</div>' +
    '<p class="muted small profile-menu-note">Actor และ Settings ใช้ร่วมทุกโปรไฟล์ · ลบได้เฉพาะโปรไฟล์ว่าง</p>';
  menu.querySelectorAll('.profile-menu-item').forEach(function(btn) {
    btn.addEventListener('click', function() { switchProfile(btn.dataset.profileId); });
  });
  const createBtn = document.getElementById('profile-create');
  const nameInput = document.getElementById('profile-new-name');
  if (createBtn && nameInput) {
    createBtn.addEventListener('click', function() {
      const name = nameInput.value.trim();
      if (!name) { showToast('ตั้งชื่อโปรไฟล์ก่อน', 'warning'); nameInput.focus(); return; }
      if (workspaceProfiles.some(function(p) { return p.name === name; })) { showToast('มีโปรไฟล์ชื่อนี้อยู่แล้ว', 'warning'); return; }
      const profile = { id: 'profile-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name.slice(0, 60), createdAt: new Date().toISOString(), mode: 'easy' };
      workspaceProfiles.push(profile);
      saveProfileState();
      switchProfile(profile.id);
      showToast('สร้างโปรไฟล์ “' + profile.name + '” แล้ว — เริ่มจากคลังว่าง', 'success');
    });
    nameInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') createBtn.click(); });
  }
  const renameBtn = document.getElementById('profile-rename');
  if (renameBtn && nameInput) {
    renameBtn.addEventListener('click', function() {
      const profile = activeProfile();
      if (!profile) return;
      const value = nameInput.value.trim();
      if (!value) { showToast('พิมพ์ชื่อใหม่ในช่องด้านบน แล้วกดเปลี่ยนชื่อ', 'warning'); nameInput.focus(); return; }
      if (workspaceProfiles.some(function(p) { return p.id !== profile.id && p.name === value; })) { showToast('มีโปรไฟล์ชื่อนี้อยู่แล้ว', 'warning'); return; }
      profile.name = value.slice(0, 60);
      saveProfileState();
      renderProfileMenu();
      updateProfileUi();
      showToast('เปลี่ยนชื่อโปรไฟล์เป็น “' + profile.name + '” แล้ว', 'success');
    });
  }
  const deleteBtn = document.getElementById('profile-delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', function() {
      const profile = activeProfile();
      if (!profile) return;
      if (workspaceProfiles.length <= 1) { showToast('ต้องมีอย่างน้อย 1 โปรไฟล์', 'warning'); return; }
      writePoolStateNow();
      if ((profileCounts()[profile.id] || 0) > 0) {
        showToast('โปรไฟล์นี้ยังมีงานอยู่ — ลบได้เฉพาะโปรไฟล์ว่าง', 'warning');
        return;
      }
      if (!window.confirm('ลบโปรไฟล์ “' + profile.name + '”?')) return;
      try {
        localStorage.removeItem(poolKeyFor(profile.id));
        localStorage.removeItem(scheduleKeyFor(profile.id));
      } catch (error) { /* nothing stored */ }
      workspaceProfiles = workspaceProfiles.filter(function(p) { return p.id !== profile.id; });
      activeProfileId = workspaceProfiles[0].id;
      saveProfileState();
      loadPoolState();
      renderAfterProfileChange();
      showToast('ลบโปรไฟล์แล้ว — สลับไป “' + activeProfile().name + '”', 'info');
    });
  }
}

function switchProfile(id) {
  if (!workspaceProfiles.some(function(p) { return p.id === id; })) return;
  if (id === activeProfileId) return;
  flushPoolStateForSwitch();
  saveRecurringTasks(loadRecurringTasks());
  activeProfileId = id;
  saveProfileState();
  loadPoolState();
  applyModeUi(true);
  renderAfterProfileChange();
  showToast('สลับไปโปรไฟล์ “' + activeProfile().name + '” แล้ว', 'info');
}

function renderAfterProfileChange() {
  selectedCandidateId = null;
  lastDraft = null;
  if (dom.contentDraftPanel) dom.contentDraftPanel.classList.add('hidden');
  renderCandidatePool();
  renderContentLibrary();
  renderDashboard();
  renderPublishQueue();
  renderSourceLibrary();
  renderScheduleTasks();
  renderProfileMenu();
  updateProfileUi();
}

function bindProfileSwitcher() {
  const pill = document.getElementById('profile-switch');
  const menu = document.getElementById('profile-menu');
  if (!pill || !menu || pill.dataset.bound === '1') return;
  pill.dataset.bound = '1';
  pill.addEventListener('click', function(e) {
    e.stopPropagation();
    const hidden = menu.classList.toggle('hidden');
    pill.setAttribute('aria-expanded', hidden ? 'false' : 'true');
    if (!hidden) renderProfileMenu();
  });
  document.addEventListener('click', function(e) {
    if (!menu.classList.contains('hidden') && !menu.contains(e.target) && !pill.contains(e.target)) {
      menu.classList.add('hidden');
      pill.setAttribute('aria-expanded', 'false');
    }
  });
}

// ----- Easy / Advance mode (per profile) -----

function currentMode() {
  const p = activeProfile();
  return p && p.mode === 'advance' ? 'advance' : 'easy';
}

// Easy Mode is the revenue lane, not a filtered copy of the full workflow:
// 1 สินค้า → 2 แผน/ผลิต → 3 ตรวจ/อนุมัติ → 4 ลิงก์ + เผยแพร่ → 5 ติดตาม → 6 รายงาน.
// Storyboard / Production / Actor stay in Advance, and qcMiniLoop() switches the
// profile to Advance when detail editing is needed, so no step becomes unreachable.
// ACE_EASY_STAGE_KEYS / STUDIO_STAGES are derived from ACE_STAGE_NAV (see below).

function stageKeysForMode(mode) {
  if (mode !== 'easy') return STUDIO_STAGES.slice();
  // Step 6 exists only once there is real result evidence to report on — it is
  // hidden rather than shown as a duplicate of Monitor.
  return ACE_EASY_STAGE_KEYS.filter(function(key) {
    return key !== 'report' || hasReportData();
  });
}

/**
 * The Easy lane as a readable string, derived from the same nav table that draws
 * the footer bar, so a label or a hidden step can never disagree with what the
 * operator actually sees.
 */
function easyLaneLabel() {
  const keys = stageKeysForMode('easy');
  return ACE_STAGE_NAV
    .filter(function(step) { return step.easy && keys.indexOf(step.key) !== -1; })
    .map(function(step) { return step.easy.replace(/^\d+\s*·\s*/, ''); })
    .join(' → ');
}

function updateModeToggle() {
  const btn = document.getElementById('mode-toggle');
  if (!btn) return;
  const mode = currentMode();
  btn.textContent = mode === 'easy' ? '⚡ Easy' : '🛠 Advance';
  btn.classList.toggle('is-advance', mode === 'advance');
  btn.title = mode === 'easy'
    ? 'Easy Mode — ' + stageKeysForMode('easy').length + ' ขั้น: ' + easyLaneLabel() + ' (กดเพื่อไป Advance ถ้าต้องแก้ละเอียด)'
    : 'Advance Mode — ครบทุกขั้น Plan / Storyboard / Production / Actor (กดเพื่อกลับ Easy)';
}

// renderStageNav() owns everything that describes the lane (nav bar, progress,
// mode tooltip). Only one case is left here: the visible stage left the lane.
function applyModeUi(skipStageReset) {
  renderStageNav();
  const keys = stageKeysForMode(currentMode());
  if (keys.indexOf(document.body.dataset.stage) !== -1) return;
  if (skipStageReset) updateStudioStage(keys[0]);
  else switchStage(keys[0]);
}

function setMode(mode) {
  const p = activeProfile();
  if (!p || p.mode === mode) return;
  p.mode = mode;
  saveProfileState();
  applyModeUi();
  showToast(mode === 'easy'
    ? '⚡ Easy Mode — ' + stageKeysForMode('easy').length + ' ขั้น: ' + easyLaneLabel()
    : '🛠 Advance Mode — ครบทุกขั้น: Plan / Storyboard / Production / Actor', 'info');
}

async function easyProduce() {
  const candidate = currentCandidate();
  if (!candidate) {
    showToast('กดเลือกการ์ดสินค้าก่อน แล้วกด ⚡ ผลิตเลย', 'warning');
    return;
  }
  const btn = document.getElementById('hero-easy-produce');
  if (btn) { btn.disabled = true; btn.textContent = '⚡ กำลังผลิต…'; }
  try {
    // Easy keeps a production preset even when the operator never picked one.
    candidate.preset = candidate.preset || 'product-hero';
    showToast('⚡ ผลิตเลย (1/2): AI เขียนคอนเทนต์…', 'info');
    await openContentDraft(candidate.id);
    if (!lastDraft) {
      showToast('ผลิตไม่สำเร็จ — ตรวจ API Key/Provider ใน Settings แล้วลองใหม่', 'error');
      return;
    }
    showToast('⚡ ผลิตเลย (2/2): เรนเดอร์ MP4 + เสียงพากย์ไทย…', 'info');
    await renderPreviewClip();
    const index = contentLibrary.indexOf(ensureLibraryItemForCandidate(candidate));
    if (index === -1) {
      showToast('ผลิตเสร็จ แต่ไม่พบรายการใน Content Library — เปิดคลังเพื่อตรวจด้วยมือ', 'warning');
      return;
    }
    showToast('⚡ ผลิตเสร็จ — เปิดจอตรวจ Full Screen ให้เลย', 'success');
    openQcOverlay(index);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⚡ ผลิตเลย'; }
  }
}

function savePoolState() {
  // Debounced: renders fire often, and stringify can be heavy with images.
  if (poolSaveTimer) return;
  poolSaveTimer = window.setTimeout(function() {
    poolSaveTimer = null;
    writePoolStateNow();
  }, 400);
}

function loadPoolState() {
  let data = null;
  try {
    const raw = localStorage.getItem(poolKeyFor(activeProfileId));
    data = raw ? JSON.parse(raw) : null;
  } catch (error) {
    data = null;
  }
  if (data && typeof data === 'object') {
    const pool = Array.isArray(data.pool) ? data.pool.filter(function(c) { return c && c.name; }) : [];
    const library = Array.isArray(data.library) ? data.library : [];
    const queue = Array.isArray(data.queue) ? data.queue : [];
    const sources = Array.isArray(data.sources) ? data.sources : [];
    if (pool.length || library.length || queue.length || sources.length) {
      candidatePool = pool;
      contentLibrary = library;
      publishQueue = queue;
      sourceItems = sources;
      return true;
    }
  }
  // Empty or missing bucket: this profile starts clean.
  candidatePool = [];
  contentLibrary = [];
  publishQueue = [];
  sourceItems = [];
  return false;
}

function clearPoolState() {
  try {
    localStorage.removeItem(poolKeyFor(activeProfileId));
    localStorage.removeItem(scheduleKeyFor(activeProfileId));
  } catch (error) { /* nothing to clear */ }
}

function loadFixtures() {
  // Real data only. The pool now persists in this browser (localStorage), so a
  // refresh keeps the user's candidates; boot restores them here.
  if (loadPoolState()) {
    renderCandidatePool();
    renderContentLibrary();
    renderDashboard();
    renderPublishQueue();
    renderSourceLibrary();
    showToast('โหลดคลังเดิมกลับมา ' + candidatePool.length + ' รายการ (เก็บไว้ในเครื่องนี้)', 'info');
    return;
  }

  // Nothing saved yet — start EMPTY. Candidates come from real Shopee data
  // only (Product Offer paste, Capture bookmarklet, or a link), never fakes.
  candidatePool = [];
  sourceItems = [];
  publishQueue = [];

  dashboardData = {
    totalSales: 0,
    totalClicks: 0,
    totalCommission: 0,
    trendPoints: [],
  };

  renderCandidatePool();
  renderContentLibrary();
  renderDashboard();
}

// ----- Candidate Pool: AI shortlist over real imported data -----

// One shortlist run considers at most this many pool items — the server
// snapshot accepts the same cap, and both sides report coverage honestly.
const AI_SHORTLIST_MAX = 12;
let lastAiResearch = null;

function aiFailureMessage(status, message) {
  if (status === 'missing_credential') return 'ยังไม่ได้ผูก API Key — เปิด Settings (⚙️) แล้ววาง OPENROUTER_API_KEY ก่อน';
  if (status === 'auth_error') return 'ผู้ให้บริการปฏิเสธ API Key — ตรวจคีย์อีกครั้งใน Settings (⚙️)';
  if (status === 'rate_limited') return 'โมเดลจำกัดอัตราการเรียก — รอสักครู่แล้วลองใหม่';
  if (status === 'timeout') return 'โมเดลไม่ตอบกลับภายในเวลา — ลองอีกครั้ง';
  if (status === 'provider_disabled') return 'ระบบปิดการเรียกเครือข่ายอยู่ (interlock) — ตรวจการตั้งค่าใน Settings (⚙️)';
  if (status === 'invalid_configuration') return 'ตั้งค่าโมเดลไม่ถูกต้อง — ตรวจชื่อโมเดลใน Settings (⚙️)';
  return message || ('AI ล้มเหลว (' + (status || 'unknown') + ')');
}

async function refreshAiStatus() {
  const chip = document.getElementById('ai-status-chip');
  if (!chip) return null;
  try {
    const response = await fetch('/api/mvp/settings/ai');
    const data = await response.json();
    const ai = data && data.ai ? data.ai : null;
    if (ai && ai.configured) {
      chip.textContent = '✨ AI พร้อม · ' + (ai.model || '');
      chip.classList.remove('is-off');
    } else {
      chip.textContent = '✨ AI ยังไม่ได้ผูก Key — Settings ⚙️';
      chip.classList.add('is-off');
    }
    return data;
  } catch (error) {
    chip.textContent = '✨ AI: เชื่อมต่อเซิร์ฟเวอร์ไม่ได้';
    chip.classList.add('is-off');
    return null;
  }
}

function toAiProduct(candidate) {
  return {
    id: candidate.id,
    name: candidate.name,
    price: candidate.price === undefined ? null : candidate.price,
    commissionRate: candidate.commissionRate === undefined ? null : candidate.commissionRate,
    rating: candidate.rating === undefined ? null : candidate.rating,
    sold: candidate.sold === undefined ? null : candidate.sold,
    shopName: candidate.shopName === undefined ? null : candidate.shopName,
    promo: candidate.promo === undefined ? null : candidate.promo,
    affiliateLink: candidate.affiliateLink || null,
  };
}

function toggleNewOfferMenu() {
  const menu = document.getElementById('new-offer-menu');
  if (menu) menu.classList.toggle('hidden');
}

function closeNewOfferMenu() {
  const menu = document.getElementById('new-offer-menu');
  if (menu) menu.classList.add('hidden');
}

function bindNewOfferMenu() {
  const menu = document.getElementById('new-offer-menu');
  if (!menu || menu.dataset.bound === '1') return;
  menu.dataset.bound = '1';
  menu.querySelectorAll('[data-mode]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const mode = btn.dataset.mode;
      closeNewOfferMenu();
      if (mode === 'top5-add') {
        runAiShortlist({ maxPicks: 5, mode: 'add' });
      } else if (mode === 'top5-replace') {
        if (!window.confirm('แทนที่คลังสินค้าด้วย 5 รายการที่ AI เลือก? รายการเดิมในคลังจะถูกถอนออกทั้งหมด')) return;
        runAiShortlist({ maxPicks: 5, mode: 'replace' });
      } else if (mode === 'top1') {
        runAiShortlist({ maxPicks: 1, mode: 'add' });
      }
    });
  });
  menu.querySelectorAll('[data-tool]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      closeNewOfferMenu();
      const target = document.getElementById(btn.dataset.tool);
      if (target) target.click();
      else showToast('ไม่พบเครื่องมือ: ' + btn.dataset.tool, 'warning');
    });
  });
  const fetchBtn = document.getElementById('new-offer-link-fetch');
  if (fetchBtn) fetchBtn.addEventListener('click', loadOfferFromLink);
  document.addEventListener('click', function(event) {
    const host = document.getElementById('new-offer-menu');
    if (!host || host.classList.contains('hidden')) return;
    if (event.target.closest('#new-offer-menu') || event.target.closest('#quick-start')) return;
    host.classList.add('hidden');
  });
}

/**
 * Where the AI reads REAL data from, in priority order: the Product Offer text
 * still in the paste box, the parsed offer preview, or the real pool itself.
 * Capture items live in the pool, so they are covered by the last source.
 */
async function resolvePickSource() {
  const input = document.getElementById('offers-text');
  const pasted = input && input.value.trim().length >= 30 ? input.value.trim() : '';
  if (pasted) {
    setOffersStatus('เตรียมอ่านข้อเสนอจากข้อความที่วางไว้…', 'info');
    let list = [];
    try {
      let response = await fetch('/api/mvp/offers/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasted }),
      });
      let data = await response.json().catch(function() { return null; });
      if (!data || !Array.isArray(data.offers) || !data.offers.length) {
        response = await fetch('/api/mvp/snap/offers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: pasted }),
        });
        data = await response.json().catch(function() { return null; });
      }
      list = (data && Array.isArray(data.offers) ? data.offers : []).map(normalizeOffer).filter(function(o) { return o.name; });
    } catch (error) {
      setOffersStatus('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ' + error.message, 'error');
      return null;
    }
    if (list.length) {
      setOffersStatus('อ่านได้ ' + list.length + ' รายการ — ให้ AI คัดเลือกจากข้อความที่วางไว้', 'success');
      return { kind: 'offers', items: list, label: 'ข้อความ Product Offer ที่วางไว้' };
    }
    setOffersStatus('อ่านข้อเสนอจากข้อความไม่สำเร็จ — เปลี่ยนไปใช้สินค้าจริงในคลังแทน', 'warning');
  }
  if (typeof importedOffers !== 'undefined' && importedOffers && importedOffers.length) {
    return { kind: 'offers', items: importedOffers, label: 'รายการจากหน้า Product Offer (พรีวิว)' };
  }
  if (candidatePool.length) {
    return { kind: 'pool', items: candidatePool, label: 'สินค้าจริงในคลัง (รวม Capture)' };
  }
  showToast('ยังไม่มีข้อมูลจริง — วางข้อความจากหน้า Product Offer, ใช้ Capture bookmarklet หรือเพิ่มด้วยลิงก์ก่อน', 'warning');
  return null;
}

function toAiProductFromOffer(offer, index) {
  return {
    id: 'off-' + index,
    name: offer.name,
    price: offer.price === undefined ? null : offer.price,
    commissionRate: offer.commission_rate === undefined ? null : offer.commission_rate,
    rating: null,
    sold: offer.sold === undefined ? null : offer.sold,
    shopName: null,
    promo: null,
    affiliateLink: offer.link || null,
  };
}

async function runAiShortlist(options) {
  const opts = options || {};
  const maxPicks = Number(opts.maxPicks) > 0 ? Math.min(5, Number(opts.maxPicks)) : 5;
  const mode = opts.mode === 'replace' ? 'replace' : 'add';
  const button = dom.quickStart;
  if (button) button.disabled = true;
  try {
    const source = await resolvePickSource();
    if (!source) return;
    const items = source.items.slice(0, AI_SHORTLIST_MAX);
    source.considered = items.length;
    source.byId = {};
    items.forEach(function(item, index) {
      source.byId[String(source.kind === 'pool' ? item.id : 'off-' + index)] = item;
    });
    const products = items.map(function(item, index) {
      return source.kind === 'pool' ? toAiProduct(item) : toAiProductFromOffer(item, index);
    });
    showToast('AI กำลังคัดสินค้าจาก: ' + source.label + ' (' + items.length + ' รายการ → เลือก ' + maxPicks + ')…', 'info');
    const response = await fetch('/api/mvp/ai/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: products, maxPicks: maxPicks }),
    });
    const data = await response.json().catch(function() { return null; });
    if (!response.ok) {
      showToast(data && data.error ? String(data.error) : ('เซิร์ฟเวอร์ปฏิเสธคำขอ (HTTP ' + response.status + ')'), 'error');
      return;
    }
    const result = data && data.result ? data.result : null;
    if (!result || result.ok !== true) {
      showToast(aiFailureMessage(result && result.status, result && result.message), 'error');
      return;
    }
    applyAnalysisToPool(result.analysis, result.model, source, mode, maxPicks);
  } catch (error) {
    showToast('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ' + error.message, 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

// ----- "1 รายการจาก Link": read the public Shopee page (no API, no login) -----

async function loadOfferFromLink() {
  const input = document.getElementById('new-offer-link-input');
  const previewHost = document.getElementById('new-offer-link-preview');
  if (!input || !previewHost) return;
  const url = input.value.trim();
  if (!url) {
    showToast('วางลิงก์สินค้าก่อน (เช่น https://s.shopee.co.th/…)', 'warning');
    input.focus();
    return;
  }
  previewHost.innerHTML = '<p class="muted small">กำลังโหลดข้อมูลจากลิงก์… (อ่านหน้าเว็บสาธารณะ — Shopee อาจบล็อก จะได้ไอดีร้าน/สินค้าไว้เติมข้อมูลจาก Capture ทีหลัง)</p>';
  try {
    const response = await fetch('/api/mvp/products/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url }),
    });
    const data = await response.json().catch(function() { return null; });
    if (!response.ok) {
      previewHost.innerHTML = '<p class="muted small">❌ ' + escapeHtml((data && data.error) ? String(data.error) : ('HTTP ' + response.status)) + '</p>';
      return;
    }
    renderLinkPreview(previewHost, data && data.preview ? data.preview : data, url);
  } catch (error) {
    previewHost.innerHTML = '<p class="muted small">❌ เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ' + escapeHtml(error.message) + '</p>';
  }
}

function renderLinkPreview(host, preview, url) {
  const previewData = preview || {};
  const title = previewData.title || null;
  const price = previewData.price !== null && previewData.price !== undefined && Number.isFinite(Number(previewData.price)) ? Number(previewData.price) : null;
  const ids = previewData.shopId && previewData.itemId ? (previewData.shopId + '.' + previewData.itemId) : (previewData.itemId || null);
  const readOk = previewData.fetched === true && Boolean(title);

  let html = '<div class="new-offer-preview-card">';
  if (previewData.image) html += '<img class="new-offer-thumb" src="' + escapeHtml(previewData.image) + '" alt="">';
  html += '<div class="new-offer-meta">';
  // Never present an id as if it were a product name: say plainly that nothing was read.
  html += '<strong>' + (title ? escapeHtml(title) : '⚠ ไม่ได้ข้อมูลสินค้าจากลิงก์') + '</strong>';

  const status = readOk
    ? '✅ อ่านหน้าเว็บได้แล้ว — ตรวจชื่อ/ราคาก่อนเพิ่มเข้าคลัง'
    : previewData.fetched === true
      ? '⚠ Shopee ตอบกลับแต่ไม่ส่งชื่อ/ราคา (หน้าต้องใช้ JavaScript หรือบล็อกบอต) — กรอกเองด้านล่าง หรือใช้ Capture'
      : '⚠ เปิดลิงก์ไม่ได้ (' + String(previewData.reason || 'blocked') + ') — กรอกเองด้านล่าง หรือใช้ Capture';
  html += '<div class="new-offer-status ' + (readOk ? 'is-ok' : 'is-warn') + '">' + escapeHtml(status) + '</div>';

  html += '<div class="muted small">' + (price !== null ? '฿' + price.toLocaleString('th-TH') : 'ยังไม่พบราคา') +
    (previewData.shopName ? ' · ' + escapeHtml(previewData.shopName) : '') +
    (ids ? ' · ร้าน/สินค้า ' + escapeHtml(ids) : '') + '</div>';

  if (!title || price === null) {
    html += '<div class="new-offer-manual">';
    if (!title) {
      html += '<input id="new-offer-manual-name" type="text" placeholder="ชื่อสินค้า (จำเป็น) — คัดลอกจากหน้าที่เปิดดู">';
    }
    if (price === null) {
      html += '<input id="new-offer-manual-price" type="number" min="0" step="0.01" placeholder="ราคา (บาท) — เว้นว่างได้ถ้ายังไม่ทราบ">';
    }
    html += '</div>';
  }

  html += '<div class="new-offer-link-actions">' +
    '<a class="btn btn-sm btn-ghost" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">เปิดลิงก์ ↗</a>' +
    '<button type="button" class="btn btn-sm btn-ghost" id="new-offer-capture">📸 ใช้ Capture เติมข้อมูล</button>' +
    '<button type="button" class="btn btn-sm btn-primary" id="new-offer-link-add"' + (title ? '' : ' disabled') + '>เพิ่มเข้าคลัง (1 รายการ)</button>' +
    '</div>';
  html += '<p class="muted small" id="new-offer-add-hint">' + (title
    ? 'สินค้าจะถูกเพิ่มพร้อมการ์ดที่มีชื่อ/ราคาจากลิงก์'
    : 'กรอกชื่อสินค้าก่อน ระบบจึงจะเพิ่มเข้าคลังได้ (กันการ์ดเปล่า)') + '</p>';
  html += '</div></div>';
  host.innerHTML = html;

  const addBtn = document.getElementById('new-offer-link-add');
  const nameInput = document.getElementById('new-offer-manual-name');
  const priceInput = document.getElementById('new-offer-manual-price');
  const hint = document.getElementById('new-offer-add-hint');

  const syncAddState = function() {
    const typed = nameInput ? nameInput.value.trim() : '';
    const canAdd = Boolean(title || typed);
    if (addBtn) addBtn.disabled = !canAdd;
    if (hint) {
      hint.textContent = canAdd
        ? 'พร้อมเพิ่มเข้าคลัง — ตรวจชื่อ/ราคาอีกครั้งก่อนกด'
        : 'กรอกชื่อสินค้าก่อน ระบบจึงจะเพิ่มเข้าคลังได้ (กันการ์ดเปล่า)';
    }
  };
  if (nameInput) nameInput.addEventListener('input', syncAddState);
  syncAddState();

  if (addBtn) addBtn.addEventListener('click', function() {
    const manualName = nameInput ? nameInput.value.trim() : '';
    const manualPrice = priceInput && priceInput.value.trim() !== '' ? Number(priceInput.value) : null;
    if (!title && !manualName) {
      showToast('Shopee ไม่ให้ข้อมูล — เปิดลิงก์ดูแล้วกรอกชื่อสินค้าก่อนเพิ่ม (หรือใช้ Capture)', 'warning');
      if (nameInput) nameInput.focus();
      return;
    }
    addLinkCandidate(previewData, url, title, price, manualName, Number.isFinite(manualPrice) ? manualPrice : null);
  });

  const captureBtn = document.getElementById('new-offer-capture');
  if (captureBtn) captureBtn.addEventListener('click', function() {
    closeNewOfferMenu();
    openDrawer('source-library', true);
    const panel = document.getElementById('capture-panel');
    if (panel) panel.classList.remove('hidden');
    scrollToBlock('capture-panel');
    showToast('ใช้ bookmarklet อ่านสินค้าจากหน้า Offers ที่ล็อกอินอยู่ แล้วกลับมาเพิ่มเข้าคลัง', 'info');
  });
}

function addLinkCandidate(preview, url, title, price, manualName, manualPrice) {
  const ids = preview.shopId && preview.itemId ? preview.shopId + '.' + preview.itemId : null;
  const typedName = typeof manualName === 'string' ? manualName.trim() : '';
  // No title and no typed name means an empty card, so refuse instead of inventing one.
  if (!title && !typedName) {
    showToast('ยังไม่มีชื่อสินค้า — กรอกชื่อก่อนเพิ่มเข้าคลัง', 'warning');
    return;
  }
  const name = title || typedName;
  const finalPrice = price !== null && price !== undefined ? price : (manualPrice !== null && manualPrice !== undefined ? manualPrice : 0);
  const fetchedOk = preview.fetched === true && (Boolean(title) || price !== null);
  const manual = !title && Boolean(typedName);
  const duplicate = candidatePool.some(function(c) {
    if (preview.shopId && preview.itemId && String(c.shopId) === String(preview.shopId) && String(c.itemId) === String(preview.itemId)) return true;
    if (ids && String(c.affiliateLink || '').indexOf(ids) !== -1) return true;
    return c.name === name && Number(c.price) === Number(finalPrice || 0);
  });
  if (duplicate) {
    showToast('สินค้านี้อยู่ในคลังแล้ว', 'warning');
    return;
  }
  candidatePool.push({
    id: nextCandidateId(),
    name: name,
    platform: 'Shopee',
    price: finalPrice || 0,
    commission: null,
    commissionRate: null,
    rating: null,
    sold: null,
    shopName: preview.shopName || null,
    image: preview.image || null,
    shopId: preview.shopId || null,
    itemId: preview.itemId || null,
    affiliateLink: url,
    subIds: { 1: '', 2: '', 3: '', 4: '', 5: '' },
    channels: ['shopee_video'],
    quality: 'Medium',
    status: 'DRAFT',
    views: 0,
    clicks: 0,
    estimatedSale: 0,
    evidence: 'จากลิงก์ Shopee (' + (fetchedOk ? 'อ่านหน้าเว็บสาธารณะสำเร็จ' : manual ? 'Shopee บล็อกการอ่าน — กรอกชื่อ/ราคาเอง ควร Capture เติมรูปทีหลัง' : 'Shopee บล็อกการอ่าน — เติมข้อมูลจาก Capture ทีหลัง') + ')',
  });
  renderCandidatePool();
  // Bind the Shopee Affiliate link immediately: select the new card so the
  // hero + affiliate panel show the pasted link as this candidate's link.
  selectCandidate(Number(candidatePool[candidatePool.length - 1].id));
  ensureCandidateSettings(candidatePool[candidatePool.length - 1]);
  renderAffiliatePanel();
  const affInput = document.getElementById('aff-link');
  const badge = document.getElementById('hero-link-state');
  if (affInput) affInput.value = url;
  if (badge) badge.textContent = 'มีลิงก์แล้ว';
  closeNewOfferMenu();
  const linkInput = document.getElementById('new-offer-link-input');
  const previewHost = document.getElementById('new-offer-link-preview');
  if (linkInput) linkInput.value = '';
  if (previewHost) previewHost.innerHTML = '';
  showToast('เพิ่ม “' + name + '” เข้าคลังแล้ว — ผูกลิงก์ Shopee Affiliate ให้การ์ดเรียบร้อย (' + url + ')', 'success');
}

function buildCandidateFromSource(item, pick) {
  const price = Number(item.price) || 0;
  const rate = Number(item.commissionRate !== undefined && item.commissionRate !== null ? item.commissionRate : item.commission_rate) || null;
  const commission = Number.isFinite(Number(item.commission)) && item.commission !== null && item.commission !== undefined
    ? Math.round(Number(item.commission) * 100) / 100
    : (rate ? Math.round(price * rate) / 100 : 0);
  return {
    id: nextCandidateId(),
    name: item.name,
    platform: 'Shopee',
    price: price,
    commission: commission,
    commissionRate: rate,
    rating: item.rating === undefined ? null : item.rating,
    sold: item.sold === undefined ? null : item.sold,
    shopName: item.shopName === undefined ? null : item.shopName,
    image: item.image || null,
    affiliateLink: item.affiliateLink || item.link || '',
    subIds: { 1: '', 2: '', 3: '', 4: '', 5: '' },
    channels: ['shopee_video'],
    quality: offerQuality(commission),
    status: 'DRAFT',
    views: 0,
    clicks: 0,
    estimatedSale: 0,
    evidence: 'AI คัดเลือกจากข้อมูลจริง — เป็นคำแนะนำ รอคุณยืนยัน',
  };
}

function applyAnalysisToPool(analysis, model, source, mode, maxPicks) {
  if (!analysis || !Array.isArray(analysis.picks) || !analysis.picks.length) {
    showToast('AI ไม่สามารถเลือกรายการได้จากข้อมูลนี้ — ลองเพิ่มข้อมูลจริงก่อน', 'warning');
    return;
  }
  function markAi(candidate, pick) {
    candidate.ai = {
      picked: true,
      fit_score: pick.fit_score,
      why: pick.why,
      risks: pick.risks,
      hook: pick.hook,
      script: pick.script,
      model: model || null,
      ran_at: new Date().toISOString(),
    };
  }
  let added = 0;
  let marked = 0;
  if (mode === 'replace') {
    const fresh = [];
    analysis.picks.forEach(function(pick) {
      const item = source.byId[String(pick.candidate_id)];
      if (!item) return;
      const candidate = buildCandidateFromSource(item, pick);
      markAi(candidate, pick);
      fresh.push(candidate);
    });
    candidatePool = fresh;
    added = fresh.length;
  } else {
    analysis.picks.forEach(function(pick) {
      const item = source.byId[String(pick.candidate_id)];
      if (!item) return;
      if (source.kind === 'pool') {
        const existing = candidatePool.find(function(c) { return String(c.id) === String(pick.candidate_id); });
        if (existing) { markAi(existing, pick); marked += 1; }
        return;
      }
      const price = Number(item.price) || 0;
      const existing = candidatePool.find(function(c) {
        return c.name === item.name && Number(c.price) === price;
      });
      if (existing) { markAi(existing, pick); marked += 1; return; }
      const candidate = buildCandidateFromSource(item, pick);
      markAi(candidate, pick);
      candidatePool.push(candidate);
      added += 1;
    });
  }

  lastAiResearch = {
    summary: analysis.summary || '',
    notes: Array.isArray(analysis.notes) ? analysis.notes : [],
    picks: analysis.picks,
    model: model || null,
    considered: source.considered,
    pool_size: candidatePool.length,
    mode: mode,
    maxPicks: maxPicks,
    source_label: source.label,
    ran_at: new Date().toISOString(),
  };
  renderCandidatePool();
  renderAiShortlistPanel();
  showToast(mode === 'replace'
    ? ('แทนที่คลังด้วย ' + added + ' รายการที่ AI เลือกแล้ว')
    : ('AI เลือกได้ ' + (added + marked) + ' รายการ' + (added ? ' (เพิ่มใหม่ ' + added + ')' : '') + ' — ดูเหตุผลในแผง AI Shortlist'),
    'success');
}

function renderAiShortlistPanel() {
  const panel = document.getElementById('ai-shortlist-panel');
  const host = document.getElementById('ai-shortlist-body');
  if (!panel || !host) return;
  if (!lastAiResearch) {
    panel.classList.add('hidden');
    return;
  }
  const r = lastAiResearch;
  let html = '<p class="muted small">รันเมื่อ ' + escapeHtml(new Date(r.ran_at).toLocaleString('th-TH')) +
    ' · โมเดล ' + escapeHtml(r.model || '-') +
    ' · พิจารณา ' + Number(r.considered) + '/' + Number(r.pool_size) + ' รายการจากคลังจริง' +
    ' · AI เป็นที่ปรึกษา — การตัดสินใจเป็นของคุณ</p>';
  if (r.summary) html += '<p class="ai-summary">' + escapeHtml(r.summary) + '</p>';
  html += '<ol class="ai-picks">';
  r.picks.forEach(function(pick) {
    const pid = parseInt(pick.candidate_id, 10);
    const idAttr = Number.isFinite(pid) ? String(pid) : '';
    html += '<li class="ai-pick"' + (idAttr ? ' data-id="' + idAttr + '"' : '') + '>' +
      '<div class="ai-pick-head"><strong>' + escapeHtml(pick.title || String(pick.candidate_id)) + '</strong>' +
      (Number.isFinite(pick.fit_score) ? '<span class="ai-fit">fit ' + pick.fit_score + '</span>' : '') +
      '</div>' +
      (pick.why ? '<p>' + escapeHtml(pick.why) + '</p>' : '') +
      (pick.risks ? '<p class="ai-risk">⚠ ' + escapeHtml(pick.risks) + '</p>' : '') +
      (pick.hook ? '<p class="ai-hook-line">💬 ' + escapeHtml(pick.hook) + '</p>' : '') +
      (pick.script && pick.script.length ? '<pre class="ai-script">' + escapeHtml(pick.script.join('\n')) + '</pre>' : '') +
      '</li>';
  });
  html += '</ol>';
  if (r.notes.length) {
    html += '<ul class="ai-notes">' + r.notes.map(function(note) { return '<li>' + escapeHtml(note) + '</li>'; }).join('') + '</ul>';
  }
  host.innerHTML = html;
  panel.classList.remove('hidden');
  host.querySelectorAll('.ai-pick[data-id]').forEach(function(row) {
    row.addEventListener('click', function() {
      selectCandidate(Number(row.dataset.id));
    });
  });
}

// ----- Settings: bind the AI Agent key (server memory only) -----

function openSettingsPanel() {
  const overlay = document.getElementById('settings-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  renderSettingsChannels();
  refreshSettingsPanel();
}

/* One text field per publish channel; the handle is what the Publish step shows
   next to the account so the operator knows where the post goes. */
function renderSettingsChannels() {
  const host = document.getElementById('settings-channels');
  if (!host) return;
  host.innerHTML = PUBLISH_CHANNELS.map(function(ch) {
    return '<label><span>' + escapeHtml(ch.label) + (ch.note ? ' · ' + escapeHtml(ch.note) : '') + '</span>' +
      '<input type="text" data-channel="' + ch.id + '" autocomplete="off" spellcheck="false"' +
      ' placeholder="ยังไม่ได้ผูกบัญชี" value="' + escapeHtml(channelHandle(ch.id)) + '"></label>';
  }).join('');
}

function saveSettingsChannels() {
  const next = {};
  document.querySelectorAll('#settings-channels [data-channel]').forEach(function(input) {
    next[input.dataset.channel] = input.value.trim();
  });
  saveChannelHandles(next);
  renderSettingsChannels();
  renderPublishConfirm();
  showToast('บันทึกช่องทางแล้ว — ใช้ในขั้น Publish ทันที', 'success');
}

function closeSettingsPanel() {
  const overlay = document.getElementById('settings-overlay');
  if (overlay) overlay.classList.add('hidden');
}

async function refreshSettingsPanel() {
  const data = await refreshAiStatus();
  const status = document.getElementById('settings-ai-status');
  if (!status) return;
  const ai = data && data.ai ? data.ai : null;
  const settings = data && data.settings ? data.settings : null;
  if (!ai || !settings) {
    status.textContent = 'อ่านสถานะไม่สำเร็จ — เซิร์ฟเวอร์ไม่ตอบสนอง';
    return;
  }
  const lines = [];
  const providerLabels = { openrouter: 'OpenRouter', orcarouter: 'OrcaRouter', gemini: 'Gemini' };
  Object.keys(settings.providers || {}).forEach(function(name) {
    const p = settings.providers[name];
    lines.push('[' + (providerLabels[name] || name) + '] Key: ' + (p.key_present ? 'ผูกแล้ว (' + (p.key_hint || 'จาก .env') + ' · ที่มา: ' + p.key_source + ')' : 'ยังไม่ได้ผูก') + ' · โมเดล: ' + p.model + ' · ปลายทาง: ' + (p.endpoint || '-'));
  });
  lines.push('Provider ที่ใช้ตอนนี้: ' + (settings.provider || 'openrouter') + ' (ที่มา: ' + settings.provider_source + ') — ทุกขั้นตอนใช้ provider นี้จนกว่าจะเปลี่ยน');
  lines.push('Live drafting: ' + (settings.live_drafting ? 'เปิด' : 'ปิด') + ' · interlock ปัจจุบัน: ' + (settings.interlock ? 'เปิด' : 'ปิด'));
  if (data.env) lines.push(String(data.env));
  status.innerHTML = lines.map(function(line) { return '<div>' + escapeHtml(line) + '</div>'; }).join('');
  const providerSelect = document.getElementById('settings-provider');
  if (providerSelect) providerSelect.value = settings.provider || 'openrouter';
  const live = document.getElementById('settings-live-toggle');
  if (live) live.checked = settings.live_drafting === true;
}

async function saveAiSettings() {
  const keyInput = document.getElementById('settings-api-key');
  const modelInput = document.getElementById('settings-model');
  const live = document.getElementById('settings-live-toggle');
  const status = document.getElementById('settings-ai-status');
  const body = {};
  const providerSelect = document.getElementById('settings-provider');
  const key = keyInput ? keyInput.value.trim() : '';
  const model = modelInput ? modelInput.value.trim() : '';
  if (providerSelect) body.provider = providerSelect.value;
  if (key) body.api_key = key;
  if (model) body.model = model;
  if (live) body.live_drafting = live.checked === true;
  if (!Object.keys(body).length) {
    if (status) status.textContent = 'ยังไม่มีอะไรให้บันทึก — ใส่ API Key หรือชื่อโมเดลก่อน';
    return;
  }
  if (keyInput) keyInput.disabled = true;
  try {
    const response = await fetch('/api/mvp/settings/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(function() { return null; });
    if (!response.ok) {
      if (status) status.textContent = 'บันทึกไม่สำเร็จ: ' + (data && data.error ? data.error : ('HTTP ' + response.status));
      return;
    }
    if (keyInput) keyInput.value = '';
    await refreshSettingsPanel();
    showToast('ผูก AI Agent แล้ว — คีย์อยู่ในหน่วยความจำของเซิร์ฟเวอร์เท่านั้น (ไม่เขียนไฟล์ ไม่เก็บในเบราว์เซอร์)', 'success');
  } catch (error) {
    if (status) status.textContent = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ' + error.message;
  } finally {
    if (keyInput) keyInput.disabled = false;
  }
}

async function pingAiConnection() {
  const status = document.getElementById('settings-ping-status');
  if (status) status.textContent = 'กำลังทดสอบการเชื่อมต่อ… (ส่งข้อความสั้น 1 รอบ)';
  try {
    const providerSelect = document.getElementById('settings-provider');
    const response = await fetch('/api/mvp/ai/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: providerSelect ? providerSelect.value : undefined }),
    });
    const data = await response.json().catch(function() { return null; });
    if (!response.ok) {
      if (status) status.textContent = 'ทดสอบไม่สำเร็จ: ' + (data && data.error ? data.error : ('HTTP ' + response.status));
      return;
    }
    const ping = data && data.ping ? data.ping : null;
    if (ping && ping.ok) {
      if (status) status.textContent = '✅ เชื่อมต่อสำเร็จ · โมเดล ' + (ping.model || '-') + (ping.latency_ms != null ? ' · ' + ping.latency_ms + ' ms' : '');
    } else {
      if (status) status.textContent = '❌ ' + aiFailureMessage(ping && ping.status, ping && ping.message);
    }
    refreshAiStatus();
  } catch (error) {
    if (status) status.textContent = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ' + error.message;
  }
}

async function resetAiSettings() {
  if (!window.confirm('ล้างค่า AI ที่ผูกไว้ในเซิร์ฟเวอร์ (Key / โมเดล / live drafting)?')) return;
  try {
    const response = await fetch('/api/mvp/settings/ai/reset', { method: 'POST' });
    if (!response.ok) {
      showToast('ล้างค่าไม่สำเร็จ (HTTP ' + response.status + ')', 'error');
      return;
    }
    await refreshSettingsPanel();
    showToast('ล้างค่า AI ในเซิร์ฟเวอร์แล้ว', 'success');
  } catch (error) {
    showToast('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ' + error.message, 'error');
  }
}

function bindSettingsPanel() {
  document.querySelectorAll('[aria-label="ตั้งค่า"]').forEach(function(btn) {
    if (btn.dataset.settingsBound === '1') return;
    btn.dataset.settingsBound = '1';
    btn.addEventListener('click', function() {
      const overlay = document.getElementById('settings-overlay');
      if (overlay && !overlay.classList.contains('hidden')) closeSettingsPanel();
      else openSettingsPanel();
    });
  });
  const close = document.getElementById('settings-close');
  if (close) close.addEventListener('click', closeSettingsPanel);
  const save = document.getElementById('settings-save');
  if (save) save.addEventListener('click', saveAiSettings);
  const ping = document.getElementById('settings-ping');
  if (ping) ping.addEventListener('click', pingAiConnection);
  const reset = document.getElementById('settings-reset');
  if (reset) reset.addEventListener('click', resetAiSettings);
  const saveChannels = document.getElementById('settings-channels-save');
  if (saveChannels) saveChannels.addEventListener('click', saveSettingsChannels);
}

/**
 * Real data source for a candidate: the Shopee product page via its affiliate
 * link when usable, otherwise a Shopee search by product name. (The offer
 * commission detail page lives behind the logged-in Affiliate dashboard —
 * Shopee has no per-offer deep link without its offer id; the Source Library
 * shortcuts open the Offers section.)
 */
function candidateSourceUrl(candidate) {
  if (!candidate) return '';
  const rawLink = candidate.affiliateLink || '';
  // ลิงก์สั้น (shope.ee) หรือลิงก์ที่ Shopee ส่งไปหน้า error ใช้ไม่ได้จริง —
  // fallback ไปค้นหาสินค้าบน Shopee ด้วยชื่อสินค้าแทน
  const unusable = !rawLink ||
    /error[_-]?page/i.test(rawLink) ||
    /shope\.ee\/(error|404)/i.test(rawLink) ||
    // ลิงก์สั้น shope.ee หมดอายุ/พังบ่อย — ใช้ค้นหาบน Shopee แทน
    /shope\.ee\/[A-Za-z0-9_-]{1,24}\/?$/i.test(rawLink);
  return unusable
    ? 'https://shopee.co.th/search?keyword=' + encodeURIComponent(candidate.name || '')
    : rawLink;
}

function openCandidateSource(candidate) {
  if (!candidate) {
    showToast('ไม่พบรายการสินค้านี้', 'warning');
    return;
  }
  const rawLink = candidate.affiliateLink || '';
  const url = candidateSourceUrl(candidate);
  const unusable = !rawLink ||
    /error[_-]?page/i.test(rawLink) ||
    /shope\.ee\/(error|404)/i.test(rawLink) ||
    /shope\.ee\/[A-Za-z0-9_-]{1,24}\/?$/i.test(rawLink);
  window.open(url, '_blank', 'noopener');
  showToast(unusable
    ? 'ลิงก์ใช้ตรงได้จำกัด — เปิดหน้าค้นหาสินค้าจริงแทน'
    : 'เปิดลิงก์สินค้าจริงแล้ว — ราคา/รีวิว/ยอดขายจริงอยู่บนหน้านั้น (ต้องล็อกอิน Shopee จึงเห็นครบ)',
    'info');
}

/* Sample product image: shown when the candidate has one; otherwise a
   clickable placeholder so the user can paste an image URL (or fill it via
   Capture / the link reader later). */
function candidateImageHtml(c) {
  if (c.image) {
    return '<img class="candidate-card-image" src="' + escapeHtml(c.image) + '" alt="' + escapeHtml(c.name || 'สินค้า') + '">';
  }
  return '<div class="candidate-card-image is-placeholder" data-image-add="' + Number(c.id) + '" title="คลิกเพื่อวาง URL รูปสินค้าตัวอย่าง (หรือเพิ่มรูปผ่าน Capture / ดึงข้อมูลจากลิงก์)">🖼️ ยังไม่มีรูปสินค้า — คลิกเพื่อใส่ URL รูป</div>';
}

function renderCandidatePool() {
  savePoolState();
  const container = dom.candidatePool;
  const noData = dom.noCandidates;

  if (!candidatePool || candidatePool.length === 0) {
    if (container) container.innerHTML = '';
    if (noData) {
      noData.classList.remove('hidden');
      noData.textContent = 'ยังไม่มี candidate ในคลัง — วางข้อความจากหน้า Product Offer แล้วกด “อ่านข้อเสนอทั้งหมด” หรือ “✨ อ่านด้วย AI”, หรือใช้ Capture bookmarklet';
    }
    return;
  }

  if (noData) noData.classList.add('hidden');

  const term = (poolFilter || '').trim().toLowerCase();
  const filtered = term
    ? candidatePool.filter(function(c) { return String(c.name || '').toLowerCase().indexOf(term) !== -1; })
    : candidatePool;
  const visible = filtered.slice(0, poolVisibleCount);

  let html = visible.map((c, i) => {
    const qualityClass = 'quality-' + c.quality.toLowerCase();
    const statusClass = 'status-' + c.status.toLowerCase();
    return `
      <div class="candidate-card" data-id="${c.id}">
        <div class="card-header">
          <span class="card-title">${c.name}</span>
          <span class="card-flags">
            ${c.sample ? '<span class="sample-badge" title="ข้อมูลตัวอย่าง ไม่ได้มาจาก Shopee">EXAMPLE</span>' : ''}
            ${c.ai && c.ai.picked ? '<span class="ai-badge" title="AI คัดเลือกจากข้อมูลจริง — คำแนะนำเท่านั้น มนุษย์ตัดสินใจต่อ">✨ AI' + (Number.isFinite(c.ai.fit_score) ? ' ' + c.ai.fit_score : '') + '</span>' : ''}
            <span class="quality-badge ${qualityClass}">${c.quality}</span>
          </span>
        </div>
        ${candidateImageHtml(c)}
        <div class="card-body">
          <div class="affiliate-link">
            <input type="text" value="${c.affiliateLink}" readonly title="ลิงก์ Shopee Affiliate ของการ์ดนี้ — กด “เปิด” เพื่อดูข้อมูลจริง">
            <button class="open-link btn btn-small btn-outline" data-open="${c.id}" title="เปิดลิงก์ดูข้อมูลจริงจาก Shopee (ราคา/รีวิว/ยอดขาย)">เปิด ↗</button>
            <button class="copy-link btn btn-small btn-ghost" data-link="${c.affiliateLink}">คัดลอก</button>
          </div>
          ${c.ai && c.ai.picked && c.ai.hook ? '<div class="ai-hook">💬 ' + escapeHtml(c.ai.hook) + '</div>' : ''}
          ${candidateDetailHtml(c)}
        </div>
        <div class="card-actions">
          <button class="btn btn-sm btn-primary move-to-lib" data-id="${c.id}">
            ย้ายเข้าคลัง
          </button>
          <button class="btn btn-sm btn-ghost view-source" data-id="${c.id}" title="เปิดสินค้าจากแหล่งข้อมูลจริง (Shopee)">
            ดูข้อมูล
          </button>
          <button class="btn btn-sm btn-ghost remove-from-pool" data-id="${c.id}">
            ถอนออก
          </button>
          <button class="btn btn-sm btn-outline draft-content" data-id="${c.id}">
            สร้าง Content
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (!filtered.length) {
    html = '<p class="muted small" style="padding:12px">ไม่พบสินค้าที่ตรงกับคำค้น</p>';
  } else if (filtered.length > visible.length) {
    html += '<button type="button" class="btn btn-sm btn-outline" id="pool-more" style="margin:8px 0">โหลดเพิ่มอีก ' + Math.min(30, filtered.length - visible.length) + ' รายการ (จาก ' + filtered.length + ')</button>';
  }

  if (container) {
    container.innerHTML = html;

    container.querySelectorAll('.candidate-card').forEach(function(card) {
      card.addEventListener('click', function(event) {
        if (event.target.closest('button')) return;
        selectCandidate(Number(card.dataset.id));
      });
    });

    if (!candidatePool.find(function(c) { return c.id === selectedCandidateId; })) {
      selectCandidate(candidatePool.length ? candidatePool[0].id : null);
    }
    const more = container.querySelector('#pool-more');
    if (more) {
      more.addEventListener('click', function() {
        poolVisibleCount += 30;
        renderCandidatePool();
      });
    }
    renderStudioMeta();

    // Sample-image placeholder: click to paste an image URL for this candidate
    container.querySelectorAll('[data-image-add]').forEach(function(placeholder) {
      placeholder.addEventListener('click', function(event) {
        event.stopPropagation();
        const id = Number(placeholder.dataset.imageAdd);
        const candidate = candidatePool.find(function(x) { return x.id === id; });
        if (!candidate) return;
        const url = window.prompt('วาง URL รูปสินค้าตัวอย่าง (https://…jpg / png / webp):', candidate.image || '');
        if (url === null) return;
        const trimmed = String(url).trim();
        if (!trimmed) {
          delete candidate.image;
          renderCandidatePool();
          return;
        }
        if (!/^https?:\/\//i.test(trimmed)) {
          showToast('URL รูปต้องขึ้นต้นด้วย http(s)://', 'warning');
          return;
        }
        candidate.image = trimmed;
        renderCandidatePool();
        showToast('ใส่รูปสินค้าตัวอย่างให้ “' + candidate.name + '” แล้ว', 'success');
      });
    });

    // Attach copy link handlers
    container.querySelectorAll('.copy-link').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var input = this.parentElement.querySelector('input');
        navigator.clipboard.writeText(input.value).then(function() {
          showToast('คัดลอกลิงก์แล้ว', 'success');
        });
      });
    });

    // Open the real data source straight from the link row
    container.querySelectorAll('.open-link').forEach(function(btn) {
      btn.addEventListener('click', function(event) {
        event.stopPropagation();
        var id = parseInt(this.dataset.open, 10);
        openCandidateSource(candidatePool.find(function(c) { return c.id === id; }));
      });
    });

    // View source product (open the real data source)
    container.querySelectorAll('.view-source').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = parseInt(this.dataset.id, 10);
        openCandidateSource(candidatePool.find(function(c) { return c.id === id; }));
      });
    });

    // Move to library
    container.querySelectorAll('.move-to-lib').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = parseInt(this.dataset.id, 10);
        var candidate = candidatePool.find(function(c) { return c.id === id; });
        if (candidate) {
          moveCandidateToLibrary(candidate);
        }
      });
    });

    // Draft content from this candidate
    container.querySelectorAll('.draft-content').forEach(function(btn) {
      btn.addEventListener('click', function() {
        openContentDraft(parseInt(btn.dataset.id, 10));
      });
    });

    // Remove from pool
    container.querySelectorAll('.remove-from-pool').forEach(function(btn) {
      btn.addEventListener('click', function() {
        candidatePool = candidatePool.filter(function(c) { return c.id !== parseInt(btn.dataset.id, 10); });
        renderCandidatePool();
        renderContentLibrary();
        showToast('ถอน candidate ออกจาก pool แล้ว', 'info');
      });
    });
  }
}

function moveCandidateToLibrary(candidate) {
  // Find existing or create new
  var libEntry = contentLibrary.find(function(c) { return c.affiliateLink === candidate.affiliateLink; });
  if (!libEntry) {
    libEntry = {
      ...candidate,
      libraryId: 'lib-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      status: 'PENDING',
      qualityScore: candidate.quality,
    };
    contentLibrary.push(libEntry);
  } else {
    // Update status if currently DRAFT in pool
    libEntry.status = 'PENDING';
  }
  renderContentLibrary();
  showToast('ย้าย candidate เข้าคลังสำเร็จ', 'success');
}

// ----- Snap / Upload Workflow -----
function showSnapWorkflow() {
  // The upload form lives in the Source Library drawer; open it explicitly so
  // Snap still works when the right-hand rail is hidden on a narrow window.
  if (typeof switchStage === 'function') switchStage('research');
  openDrawer('source-library', true);
  resetSnapForm();
  scrollToBlock('snap-upload-area');
  showToast('ลากรูปสินค้าวาง หรือคลิกกรอบเพื่ออัปโหลด แล้วกด “สร้าง Candidate Card”', 'info');
}

function resetSnapForm() {
  if (dom.snapProductName) dom.snapProductName.textContent = '-- เลือกหมวดหมู่เพื่อดูตัวอย่าง --';
  if (dom.snapProductPrice) dom.snapProductPrice.textContent = '--';
  if (dom.snapProductShop) dom.snapProductShop.textContent = '--';
  var radios = document.querySelectorAll('input[name="snap-category"]');
  if (radios.length > 0) radios[0].checked = true;
}

function handleProductImageSelect(e) {
  var file = e.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      snapImageDataUrl = reader.result;
      showSnapPreview(reader.result, file.name);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.effectAllowed = 'copy';
}

function handleDrop(e) {
  e.preventDefault();
  var file = e.dataTransfer.files[0];
  if (!file) return;
  dom.productImageUpload.files = e.dataTransfer.files;
  handleProductImageSelect({ target: dom.productImageUpload });
}

function showSnapPreview(imgSrc, productName) {
  if (dom.snapPreviewImg && imgSrc) dom.snapPreviewImg.src = imgSrc;
  if (dom.snapNameInput && !dom.snapNameInput.value) {
    dom.snapNameInput.value = String(productName || '')
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim();
  }
  var previewArea = document.querySelector('.snap-preview-area');
  if (previewArea) previewArea.classList.remove('hidden');
}

function setSnapAiStatus(message, kind) {
  if (!dom.snapAiStatus) return;
  dom.snapAiStatus.textContent = message;
  dom.snapAiStatus.className = 'muted small' +
    (kind === 'error' ? ' link-import-status-error' : kind === 'ok' ? ' link-import-status-ok' : '');
}

function snapNumber(value) {
  var num = parseFloat(value);
  return isFinite(num) && num >= 0 ? Math.round(num * 100) / 100 : 0;
}

function applyExtractedProduct(product) {
  if (!product) return;
  if (product.name && dom.snapNameInput) dom.snapNameInput.value = product.name;
  if (dom.snapPriceInput && product.price !== null && product.price !== undefined) {
    dom.snapPriceInput.value = product.price;
  }
  if (dom.snapShopInput && product.shop_name) dom.snapShopInput.value = product.shop_name;
  if (dom.snapRatingInput && product.rating !== null && product.rating !== undefined) {
    dom.snapRatingInput.value = product.rating;
  }
  if (dom.snapSoldInput && product.sold) dom.snapSoldInput.value = product.sold;

  if (dom.snapCommissionInput) {
    var amount = product.commission_amount;
    if ((amount === null || amount === undefined) && product.commission_rate && product.price) {
      amount = Math.round(product.price * product.commission_rate) / 100;
    }
    if (amount !== null && amount !== undefined) dom.snapCommissionInput.value = amount;
  }
}

async function handleSnapAiExtract() {
  var text = dom.snapText ? dom.snapText.value.trim() : '';
  if (!text) {
    setSnapAiStatus('วางข้อความจากหน้า Shopee ก่อนครับ', 'error');
    return;
  }

  setSnapAiStatus('กำลังอ่านข้อมูลด้วย AI…', null);
  if (dom.snapAiExtract) dom.snapAiExtract.disabled = true;

  try {
    var response = await fetch('/api/mvp/snap/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    });
    var data = await response.json().catch(function() { return null; });

    if (!response.ok || !data || !data.ok) {
      setSnapAiStatus((data && (data.message || data.error)) || 'อ่านข้อมูลไม่สำเร็จ', 'error');
      return;
    }

    applyExtractedProduct(data.product);
    setSnapAiStatus('อ่านข้อมูลสำเร็จ (' + (data.model || 'model') + ') — ตรวจสอบราคา/คอมมิชชันก่อนสร้างการ์ด', 'ok');
  } catch (error) {
    setSnapAiStatus('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ' + error.message, 'error');
  } finally {
    if (dom.snapAiExtract) dom.snapAiExtract.disabled = false;
  }
}

function resetSnapFormAfterAdd() {
  if (dom.snapText) dom.snapText.value = '';
  if (dom.snapNameInput) dom.snapNameInput.value = '';
  if (dom.snapPriceInput) dom.snapPriceInput.value = '';
  if (dom.snapCommissionInput) dom.snapCommissionInput.value = '';
  if (dom.snapShopInput) dom.snapShopInput.value = '';
  if (dom.snapRatingInput) dom.snapRatingInput.value = '';
  if (dom.snapSoldInput) dom.snapSoldInput.value = '';
  if (dom.productImageUpload) dom.productImageUpload.value = '';
  snapImageDataUrl = null;
  setSnapAiStatus('', null);
}

function candidateDetailHtml(c) {
  var rows = [
    ['ราคา', c.price ? '฿' + c.price.toLocaleString('th-TH') : '—'],
    ['ค่าคอม', (c.commissionRate ? c.commissionRate + '% · ' : '') + (c.commission ? '฿' + c.commission.toLocaleString('th-TH') : '—')],
    ['คะแนน', c.rating ? c.rating + ' / 5' : '—'],
    ['ยอดขาย', c.sold || '—'],
    ['ร้านค้า', c.shopName || '—'],
    ['แหล่งข้อมูลจริง', '<a class="source-link" href="' + escapeHtml(candidateSourceUrl(c)) + '" target="_blank" rel="noopener noreferrer">สินค้า ↗</a> · <a class="source-link" href="https://affiliate.shopee.co.th/offer/product_offer" target="_blank" rel="noopener noreferrer">Offers ↗</a>'],
  ];
  if (c.perf) {
    rows.push(['ผลจริง', 'V ' + (c.perf.views || 0) + ' · C ' + (c.perf.clicks || 0) + ' · O ' + (c.perf.orders || 0) + ' · ฿' + Number(c.perf.commission_thb || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 }) + (c.perf.platform ? ' · ' + c.perf.platform : '')]);
  }
  return '<dl class="detail-list">' + rows.map(function(row) {
    return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>';
  }).join('') + '</dl>';
}

function confirmSnapAndAddCandidate() {
  var name = dom.snapNameInput ? dom.snapNameInput.value.trim() : '';
  if (!name) {
    showToast('กรอกหรือดึงชื่อสินค้าถ่อนสร้าง Candidate Card', 'warning');
    if (dom.snapNameInput) dom.snapNameInput.focus();
    return;
  }

  var price = snapNumber(dom.snapPriceInput && dom.snapPriceInput.value);
  var commission = snapNumber(dom.snapCommissionInput && dom.snapCommissionInput.value);
  var shopName = dom.snapShopInput ? dom.snapShopInput.value.trim() : '';
  var rating = snapNumber(dom.snapRatingInput && dom.snapRatingInput.value);
  var sold = dom.snapSoldInput ? dom.snapSoldInput.value.trim() : '';
  var category = document.querySelector('input[name="snap-category"]:checked')?.value || 'clothing';

  if (!commission && price > 0) {
    commission = Math.round(price * ESTIMATED_COMMISSION_RATE * 100) / 100;
  }

  var linkId = 'SMP' + String(Math.floor(100000000 + Math.random() * 900000000));
  var quality = commission >= 100 ? 'High' : commission >= 40 ? 'Medium' : 'Low';

  var newCandidate = {
    id: candidatePool.length + 1,
    name: name,
    platform: 'Shopee',
    affiliateLink: AFFILIATE_BASE + '/product/' + linkId,
    quality: quality,
    status: 'DRAFT',
    views: 0,
    clicks: 0,
    estimatedSale: 0,
    commission: commission,
    price: price,
    rating: rating || null,
    sold: sold || null,
    shopName: shopName || null,
    category: category,
    image: snapImageDataUrl || null,
    evidence: 'Snap ภาพสินค้า' + (shopName ? ' • ' + shopName : '') + (sold ? ' • ขายได้ ' + sold : '')
  };

  candidatePool.push(newCandidate);
  contentLibrary.push({ ...newCandidate, libraryId: 'lib-' + newCandidate.id, status: 'PENDING', qualityScore: quality });
  sourceItems.push({
    name: name,
    kind: 'SNAP',
    detail: (price > 0 ? '฿' + price.toFixed(2) : 'ยังไม่ทราบราคา') +
      (commission > 0 ? ' • คอมมิชชัน ฿' + commission.toFixed(2) : ''),
    badgeClass: 'status-approved'
  });

  renderCandidatePool();
  renderContentLibrary();
  renderSourceLibrary();
  resetSnapFormAfterAdd();
  var previewArea = document.querySelector('.snap-preview-area');
  if (previewArea) previewArea.classList.add('hidden');
  showToast('สร้าง Candidate Card จากภาพแล้ว: ' + name, 'success');
}

// ----- Content draft from a snap candidate -----

function setDraftStatus(message, kind) {
  if (!dom.contentDraftStatus) return;
  dom.contentDraftStatus.textContent = message;
  dom.contentDraftStatus.className = 'muted small' +
    (kind === 'error' ? ' link-import-status-error' : kind === 'ok' ? ' link-import-status-ok' : '');
}

function renderContentDraft(content) {
  if (dom.draftHook) dom.draftHook.textContent = content.hook || '—';
  if (dom.draftScript) dom.draftScript.textContent = content.script || '—';
  if (dom.draftCaption) dom.draftCaption.textContent = content.caption || '—';
  if (dom.draftHashtags) {
    dom.draftHashtags.textContent = (content.hashtags && content.hashtags.length)
      ? content.hashtags.join(' ')
      : '—';
  }
}

function draftAsText(candidate) {
  if (!lastDraft) return '';
  const c = ensureCandidateSettings(candidate) || candidate;
  const preset = currentProductionPreset(candidate);
  const channels = (c.channels || []).map(function(id) {
    const found = PUBLISH_CHANNELS.find(function(ch) { return ch.id === id; });
    return found ? found.label : id;
  });
  const price = Number(candidate.price) || 0;
  const rate = Number(candidate.commissionRate);
  const commission = Number(candidate.commission);
  return [
    '📦 ชุดโพสต์ — ' + (candidate.name || ''),
    '',
    'Hook: ' + (lastDraft.hook || ''),
    'บทพูด (25–30 วิ): ' + (lastDraft.script || ''),
    'แคปชัน: ' + (lastDraft.caption || ''),
    'แฮชแท็ก: ' + ((lastDraft.hashtags || []).join(' ')),
    'สไตล์การผลิต: ' + preset.label + ' (' + preset.tone + ')',
    '',
    'CTA: ' + (c.cta || 'กดลิงก์ในโปรไฟล์ / พิมพ์ Shopee Video'),
    'ราคา: ' + (price ? '฿' + price.toLocaleString('th-TH') : '—'),
    'ค่าคอม: ' + (Number.isFinite(rate) && rate > 0 ? rate + '%' : '—') + (Number.isFinite(commission) && commission > 0 ? ' · ฿' + commission.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : ''),
    'ลิงก์ affiliate: ' + (candidate.affiliateLink || '— (ยังไม่ผูก — วางลิงก์ก่อนโพสต์)'),
    'ช่องทาง: ' + (channels.length ? channels.join(', ') : 'Shopee Video'),
    'รูปที่ต้องเตรียม: 3–5 รูป (สินค้า / ใช้งานจริง / รีวิว) — ' + (candidate.image ? 'มีรูปหลักแล้ว 1 รูป' : 'ยังไม่มีรูป'),
    '',
    '🖼 คำสั่งสร้างภาพ (นำไปเจนใน Flow/Sora ตามสไตล์ ' + preset.label + '):',
    buildImagePrompts(candidate, preset).join('\n'),
    '',
    'เช็กลิสต์ก่อนโพสต์: ตรวจราคา/โปร • เปิดลิงก์ให้ได้ • ใส่แคปชัน+แฮชแท็ก • CTA ตรงโปรไฟล์ • โพสต์ Shopee Video + TikTok',
  ].join('\n');
}

async function openContentDraft(candidateId) {
  var candidate = candidatePool.find(function(c) { return c.id === candidateId; });
  if (!candidate) return;

  if (dom.contentDraftPanel) {
    dom.contentDraftPanel.classList.remove('hidden');
    dom.contentDraftPanel.dataset.candidateId = String(candidateId);
  }
  lastDraft = null;
  renderContentDraft({});
  setDraftStatus('กำลังสร้าง Content ด้วย AI…', null);

  try {
    var response = await fetch('/api/mvp/snap/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product: {
          name: candidate.name,
          platform: candidate.platform,
          price: candidate.price || null,
          commission: candidate.commission || null,
          rating: candidate.rating || null,
          sold: candidate.sold || null,
          promo: candidate.evidence || null,
          cta: candidate.cta || null,
          preset: currentProductionPreset(candidate).label + ' — ' + currentProductionPreset(candidate).tone,
          affiliateLink: candidate.affiliateLink || null
        }
      })
    });
    var data = await response.json().catch(function() { return null; });

    if (!response.ok || !data || !data.ok) {
      setDraftStatus((data && (data.message || data.error)) || 'สร้าง Content ไม่สำเร็จ', 'error');
      return;
    }

    lastDraft = data.content;
    renderContentDraft(data.content);
    setDraftStatus('สร้าง Content สำเร็จ (' + (data.model || 'model') + ') — ตรวจสอบราคา/คอมมิชชันก่อนโพสต์', 'ok');
  } catch (error) {
    setDraftStatus('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ' + error.message, 'error');
  }
}

// ----- Revenue-first tools: batch post kits + tracking sheet -----

function downloadTextFile(filename, text) {
  try {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    return true;
  } catch (error) {
    return false;
  }
}

function postKitText(candidate, content, index, total, model) {
  const c = ensureCandidateSettings(candidate) || candidate;
  const channels = (c.channels || []).map(function(id) {
    const found = PUBLISH_CHANNELS.find(function(ch) { return ch.id === id; });
    return found ? found.label : id;
  });
  return [
    '════════ ชุดโพสต์ ' + (index + 1) + '/' + total + ' ════════',
    '📦 ' + (c.name || ''),
    '',
    'Hook: ' + ((content && content.hook) || ''),
    'บทพูด (25–30 วิ): ' + ((content && content.script) || ''),
    'แคปชัน: ' + ((content && content.caption) || ''),
    'แฮชแท็ก: ' + (((content && content.hashtags) || []).join(' ')),
    '',
    'CTA: ' + (c.cta || 'กดลิงก์ในโปรไฟล์ / พิมพ์ Shopee Video'),
    'ราคา: ' + (c.price ? '฿' + Number(c.price).toLocaleString('th-TH') : '—'),
    'ค่าคอม: ' + (c.commissionRate ? c.commissionRate + '%' : '—') + (c.commission ? ' · ฿' + Number(c.commission).toLocaleString('th-TH', { maximumFractionDigits: 2 }) : ''),
    'ลิงก์ affiliate: ' + (c.affiliateLink || '— (ยังไม่ผูก — วางลิงก์ก่อนโพสต์)'),
    'ช่องทาง: ' + (channels.length ? channels.join(', ') : 'Shopee Video'),
    'รูปที่ต้องเตรียม: 3–5 รูป (สินค้า / ใช้งานจริง / รีวิว)',
    'โมเดล: ' + (model || '-'),
    '',
    'เช็กลิสต์ก่อนโพสต์: ตรวจราคา/โปร • เปิดลิงก์ให้ได้ • ใส่แคปชัน+แฮชแท็ก • CTA ตรงโปรไฟล์ • โพสต์ Shopee Video + TikTok',
  ].join('\n');
}

async function generateBatchPostKits() {
  if (!candidatePool.length) {
    showToast('คลังยังว่าง — นำเข้าสินค้าจริงก่อน (CSV จาก Offers / Capture / ลิงก์)', 'warning');
    return;
  }
  const items = candidatePool.slice(0, 10);
  const btn = document.getElementById('batch-drafts');
  if (btn) btn.disabled = true;
  const parts = [];
  let okCount = 0;
  try {
    for (let i = 0; i < items.length; i++) {
      const c = ensureCandidateSettings(items[i]);
      showToast('สร้างชุดโพสต์ ' + (i + 1) + '/' + items.length + ' — ' + String(c.name || '').slice(0, 32) + '…', 'info');
      try {
        const response = await fetch('/api/mvp/snap/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product: {
              name: c.name,
              platform: c.platform,
              price: c.price || null,
              commission: c.commission || null,
              rating: c.rating || null,
              sold: c.sold || null,
              promo: c.evidence || null,
              cta: c.cta || null,
              affiliateLink: c.affiliateLink || null,
            },
          }),
        });
        const data = await response.json().catch(function() { return null; });
        if (response.ok && data && data.ok) {
          parts.push(postKitText(c, data.content, i, items.length, data.model));
          okCount += 1;
          continue;
        }
        parts.push('⚠ ' + (c.name || '') + ' — สร้างไม่สำเร็จ: ' + ((data && (data.message || data.error)) || ('HTTP ' + response.status)));
      } catch (error) {
        parts.push('⚠ ' + (c.name || '') + ' — เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ' + error.message);
      }
    }
    const bundle = parts.join('\n\n');
    window.__lastPostKits = bundle;
    const filename = 'ace-post-kits-' + new Date().toISOString().slice(0, 10) + '.txt';
    downloadTextFile(filename, bundle);
    try {
      await navigator.clipboard.writeText(bundle);
      showToast('สร้างชุดโพสต์สำเร็จ ' + okCount + '/' + items.length + ' — คัดลอกและดาวน์โหลด ' + filename + ' แล้ว', 'success');
    } catch (clipError) {
      showToast('สร้างชุดโพสต์ ' + okCount + '/' + items.length + ' — ดาวน์โหลดไฟล์แล้ว (คัดลอกอัตโนมัติไม่ได้ในเบราว์เซอร์นี้)', 'success');
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function buildTrackingCsv() {
  const header = ['วันที่โพสต์', 'สินค้า', 'แพลตฟอร์ม', 'Sub_id', 'Views', 'Clicks', 'Orders', 'คอมมิชชัน_THB', 'คลิกที่ผิด', 'ลูกค้าใหม่', 'หมายเหตุ'];
  const rows = [header.join(',')];
  candidatePool.slice(0, 10).forEach(function(c) {
    const escaped = function(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    const libItem = contentLibrary.find(function(it) { return it.libraryId === 'lib-' + c.id && it.publishRecord; });
    rows.push([
      libItem && libItem.publishRecord && libItem.publishRecord.publishedAt ? new Date(libItem.publishRecord.publishedAt).toISOString().slice(0, 10) : '',
      escaped(c.name),
      escaped((c.channels || ['Shopee Video']).join(' / ')),
      escaped(libItem && libItem.publishRecord ? [libItem.publishRecord.subId1, libItem.publishRecord.subId2].filter(Boolean).join('/') : ''),
      '', '', '',
      c.commission ? String(c.commission) : '',
      '', '',
      escaped(c.affiliateLink || ''),
    ].join(','));
  });
  return rows.join('\r\n');
}

function downloadTrackingCsv() {
  if (!candidatePool.length) {
    showToast('ยังไม่มีสินค้าในคลัง — นำเข้าสินค้าจริงก่อน', 'warning');
    return;
  }
  const csv = buildTrackingCsv();
  const filename = 'ace-tracking-' + new Date().toISOString().slice(0, 10) + '.csv';
  const ok = downloadTextFile(filename, '\uFEFF' + csv);
  showToast(ok
    ? 'ดาวน์โหลดเทมเพลตติดตามผลแล้ว (' + (candidatePool.slice(0, 10).length) + ' รายการ) — กรอก views/clicks/orders หลังโพสต์'
    : 'ดาวน์โหลดไฟล์ไม่ได้ — ใช้คัดลอกแทน',
    ok ? 'success' : 'warning');
}

// ----- Production presets: actor + background style for the clip -----

const PRODUCTION_PRESETS = [
  { id: 'cute-cartoon', label: 'การ์ตูนน่ารัก + ฉากหลังใหม่', badge: 'CUTE CARTOON', bgFrom: '#2A1B4A', bgAccent: '#FF7EB6', actorType: 'cartoon_2d', tone: 'สนุก สดใส น่ารัก เป็นกันเอง', imagePrompt: 'ตัวการ์ตูนน่ารักสไตล์ kawaii ถือ {product} ยิ้มสดใส บนฉากหลังใหม่สีพาสเทล แสงอ่อนนุ่ม' },
  { id: 'cute-mascot', label: 'มาสคอตน่ารัก + ฉากใหม่', badge: 'MASCOT', bgFrom: '#1B3A4A', bgAccent: '#FFB347', actorType: 'mascot', tone: 'ขี้เล่น น่ารัก พลังล้น', imagePrompt: 'มาสคอตน่ารักรูปทรงกลมถือ {product} กระโดดดีใจ ฉากหลังใหม่สีสดใส' },
  { id: 'real-presenter', label: 'พิธีกรจริง + ฉากสตูดิโอ', badge: 'PRESENTER', bgFrom: '#12233B', bgAccent: '#2E7DF6', actorType: 'human', tone: 'จริงใจ น่าเชื่อถือ เหมือนเพื่อนแนะนำ', imagePrompt: 'ภาพพิธีกรจริงถือ {product} ในสตูดิโอไฟสว่าง มุมใกล้ ดูน่าเชื่อถือ' },
  { id: 'product-hero', label: 'โฟกัสสินค้า (ไม่มีนักแสดง)', badge: 'PRODUCT HERO', bgFrom: '#101820', bgAccent: '#9FE8B6', actorType: 'product', tone: 'กระชับ ตรงประเด็น เน้นสินค้า', imagePrompt: '{product} เด่นกลางเฟรม พื้นหลังเรียบสีเข้ม ไฟสินค้าสะท้อนขอบ' },
];

function getProductionPreset(id) {
  return PRODUCTION_PRESETS.find(function(p) { return p.id === id; }) || PRODUCTION_PRESETS[0];
}

function currentProductionPreset(candidate) {
  const el = document.getElementById('clip-preset');
  return getProductionPreset((candidate && candidate.preset) || (el ? el.value : undefined));
}

function buildImagePrompts(candidate, preset) {
  const product = String((candidate && candidate.name) || 'สินค้า');
  return [
    '1) ภาพหลัก: ' + preset.imagePrompt.replace('{product}', product),
    '2) ภาพระยะใกล้: ' + product + ' — รายละเอียดสินค้า มุมใกล้ ไฟนุ่ม เห็นคุณภาพชัด',
    '3) ภาพบรรยากาศ: ' + product + ' ในฉากหลังใหม่สไตล์ ' + preset.label + ' มีพื้นที่วางข้อความด้านบน',
    '4) ภาพปิดคลิป: ' + product + ' พร้อมพื้นที่ใส่ตัวหนังสือ CTA ด้านล่าง สไตล์เดียวกับภาพหลัก',
  ];
}

// ----- Clip preview: render the draft to a real MP4 (local ffmpeg) -----

async function renderPreviewClip() {
  const candidateId = dom.contentDraftPanel ? parseInt(dom.contentDraftPanel.dataset.candidateId, 10) : NaN;
  const candidate = candidatePool.find(function(c) { return c.id === candidateId; });
  const status = document.getElementById('clip-preview-status');
  const host = document.getElementById('clip-preview-host');
  if (!candidate || !lastDraft) {
    showToast('สร้าง Content ด้วย AI ก่อน แล้วค่อยทำคลิปพรีวิว', 'warning');
    return;
  }
  const hook = String(lastDraft.hook || '').trim();
  const body = String(lastDraft.script || '').trim();
  const sentences = [];
  body.split(/\n+/).forEach(function(chunk) {
    String(chunk).split(/(?<=[.!?。])\s+/).forEach(function(part) {
      const line = part.trim();
      if (line) sentences.push(line);
    });
  });
  const lines = [];
  if (hook) lines.push(hook);
  sentences.forEach(function(line) { if (lines.length < 9) lines.push(line); });
  lines.push(candidate.cta ? String(candidate.cta).slice(0, 80) : 'กดลิงก์ในโปรไฟล์');
  const images = [];
  if (candidate.image && /^(https:\/\/|data:image\/)/i.test(String(candidate.image))) images.push(candidate.image);
  const extraField = document.getElementById('clip-images');
  if (extraField && extraField.value.trim()) {
    extraField.value.split(/\r?\n/).map(function(line) { return line.trim(); })
      .filter(function(line) { return /^(https:\/\/|data:image\/)/i.test(line); })
      .slice(0, 4)
      .forEach(function(url) { images.push(url); });
  }
  const preset = currentProductionPreset(candidate);
  if (status) status.textContent = 'กำลังเรนเดอร์ MP4 ด้วย ffmpeg…' + (images.length ? ' (มี ' + Math.min(5, images.length) + ' รูป)' : '') + ' · สไตล์ ' + preset.label + ' · เสียงพากย์ไทย (10–40 วินาที)';
  if (host) host.innerHTML = '';
  try {
    const response = await fetch('/api/mvp/preview/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines: lines.slice(0, 10), images: images.slice(0, 5), cta: candidate.cta || '', narrate: true, preset: currentProductionPreset(candidate).id, style: (function() { const p = currentProductionPreset(candidate); return { badge: p.badge, from: p.bgFrom, accent: p.bgAccent }; })() }),
    });
    const data = await response.json().catch(function() { return null; });
    if (!response.ok) {
      if (status) status.textContent = 'เรนเดอร์ไม่สำเร็จ: ' + ((data && data.error) || ('HTTP ' + response.status));
      return;
    }
    if (status) status.textContent = 'คลิปพรีวิวพร้อม — ' + (data.duration_s || '?') + 's · ' + Math.round((data.bytes || 0) / 1024) + ' KB · ' + (data.width || 1080) + '×' + (data.height || 1920) + ' · ฟอนต์ ' + (data.font || '-') + ' · สไตล์ ' + preset.label +
      (data.narration && data.narration.ok ? ' · เสียงพากย์ ' + (data.narration.voice || '') + ' (' + data.narration.lines + '/' + data.narration.total + ' บรรทัด)' : ' · ไม่มีเสียงพากย์' + (data.narration && data.narration.error ? ' (' + String(data.narration.error).slice(0, 80) + ')' : ''));
    if (host) {
      host.innerHTML = '<video controls autoplay playsinline style="width:100%;max-height:520px;border-radius:12px;background:#000" src="' + data.url + '"></video>' +
        '<p class="muted small"><a href="' + data.url + '" download target="_blank" rel="noopener">ดาวน์โหลด MP4</a> — ตรวจลำดับภาพ/ข้อความ/CTA ก่อนนำไปตัดต่อหรือโพสต์</p>';
    }
    var lineageItem = attachRenderToLineage(candidate, data);
    if (lineageItem) renderContentLibrary();
    showToast(lineageItem
      ? 'สร้างคลิปสำเร็จ — ผูกเป็น lineage v' + lineageItem.lineage.version + ' ใน Content Library แล้ว (กด "ตรวจ Full Screen" เพื่อตรวจใหญ่)'
      : 'สร้างคลิปพรีวิวสำเร็จ — ดูได้ในแผง Content Draft', 'success');
  } catch (error) {
    if (status) status.textContent = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ' + error.message;
  }
}

// ----- Results import: real performance data from the tracking CSV -----

function resultsFromCsv(text) {
  const probe = String(text || '').replace(/^\uFEFF/, '');
  const firstLine = probe.split(/\r?\n/, 1)[0] || '';
  const delimiter = detectDelimiter(firstLine);
  const rows = parseDelimited(probe, delimiter);
  if (!rows.length) return [];
  const header = rows[0].map(function(c) { return String(c || '').trim().toLowerCase(); });
  const findCol = function(names) {
    for (let i = 0; i < header.length; i++) {
      for (let n = 0; n < names.length; n++) {
        if (header[i].indexOf(names[n].toLowerCase()) !== -1) return i;
      }
    }
    return -1;
  };
  const col = {
    name: findCol(['สินค้า', 'product']),
    platform: findCol(['แพลตฟอร์ม', 'platform']),
    subId: findCol(['sub_id']),
    views: findCol(['views']),
    clicks: findCol(['clicks']),
    orders: findCol(['orders']),
    commission: findCol(['คอมมิชชัน_thb', 'คอมมิชชัน', 'commission']),
    estimated: findCol(['ประมาณ', 'estimated']),
    invalid: findCol(['คลิกที่ผิด', 'invalid']),
    newCust: findCol(['ลูกค้าใหม่', 'new_customers', 'new customer']),
    note: findCol(['หมายเหตุ', 'note']),
    postedAt: findCol(['วันที่โพสต์', 'date']),
  };
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const pick = function(key) {
      const i = col[key];
      return i === -1 || cells[i] === undefined ? '' : String(cells[i]).trim();
    };
    const name = pick('name');
    if (!name) continue;
    out.push({
      name: name,
      platform: pick('platform'),
      sub_id: pick('subId'),
      views: Number(pick('views')) || 0,
      clicks: Number(pick('clicks')) || 0,
      orders: Number(pick('orders')) || 0,
      commission_thb: Number(String(pick('commission')).replace(/[^0-9.]/g, '')) || 0,
      commission_estimated_thb: Number(String(pick('estimated')).replace(/[^0-9.]/g, '')) || 0,
      invalid_clicks: Number(pick('invalid')) || 0,
      new_customers: Number(pick('newCust')) || 0,
      note: pick('note'),
      posted_at: pick('postedAt'),
    });
  }
  return out;
}

function handleResultsCsvFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function() {
    try {
      const rows = resultsFromCsv(String(reader.result || ''));
      if (!rows.length) {
        showToast('อ่านไฟล์ผลลัพธ์ไม่ได้ — ต้องมีหัวคอลัมน์ "สินค้า"', 'error');
        return;
      }
      const result = applyPerfRows(rows, file.name);
      renderCandidatePool();
      renderContentLibrary();
      renderDashboard();
      renderStageNav();
      if (document.body.dataset.stage === 'report') renderReport();
      showToast('นำเข้าหลักฐาน ' + rows.length + ' แถว — จับคู่ได้ ' + result.matched + ' (ไม่จับคู่ ' + result.unmatched + ') · Orders ' + result.orders + ' · ค่าคอม ฿' + result.commission.toLocaleString('th-TH', { maximumFractionDigits: 2 }) + (result.invalid ? ' · คลิกที่ผิด ' + result.invalid : ''), result.matched ? 'success' : 'warning');
    } catch (error) {
      showToast('อ่านไฟล์ไม่สำเร็จ: ' + error.message, 'error');
    }
  };
  reader.readAsText(file, 'utf-8');
}

// Apply verified performance rows to candidates AND library items, with provenance stamps.
function applyPerfRows(rows, sourceFileName) {
  const result = { matched: 0, unmatched: 0, orders: 0, commission: 0, invalid: 0, newCustomers: 0 };
  const importedAt = new Date().toISOString();
  rows.forEach(function(row) {
    const name = String(row.name || '').trim();
    if (!name) return;
    let candidate = candidatePool.find(function(c) { return String(c.name || '').trim() === name; });
    if (!candidate) {
      const lower = name.toLowerCase();
      candidate = candidatePool.find(function(c) {
        const cn = String(c.name || '').toLowerCase();
        return cn && (cn.indexOf(lower) !== -1 || lower.indexOf(cn) !== -1);
      });
    }
    const targets = [];
    if (candidate) targets.push(candidate);
    const libItem = contentLibrary.find(function(it) {
      return (candidate && it.libraryId === 'lib-' + candidate.id) || String(it.name || '').trim() === name;
    });
    if (libItem) targets.push(libItem);
    if (!targets.length) { result.unmatched += 1; return; }
    targets.forEach(function(t) {
      const entry = {
        date: row.posted_at || importedAt.slice(0, 10),
        platform: row.platform || null,
        sub_id: row.sub_id || null,
        views: row.views,
        clicks: row.clicks,
        orders: row.orders,
        commission_thb: row.commission_thb,
        commission_estimated_thb: row.commission_estimated_thb || 0,
        invalid_clicks: row.invalid_clicks || 0,
        new_customers: row.new_customers || 0,
        note: row.note || null,
        imported_at: importedAt,
        source_file: sourceFileName || null,
      };
      t.perf = entry;
      // Revenue history: every dated evidence entry feeds the day/week/month metrics.
      // Same date+platform+sub_id replaces the old entry (re-import = updated evidence).
      if (!Array.isArray(t.perfHistory)) t.perfHistory = [];
      const key = entry.date + '|' + (entry.platform || '') + '|' + (entry.sub_id || '');
      const idx = t.perfHistory.findIndex(function(h) { return (h.date || '') + '|' + (h.platform || '') + '|' + (h.sub_id || '') === key; });
      if (idx >= 0) t.perfHistory[idx] = entry; else t.perfHistory.push(entry);
    });
    result.matched += 1;
    result.orders += row.orders || 0;
    result.commission += row.commission_thb || 0;
    result.invalid += row.invalid_clicks || 0;
    result.newCustomers += row.new_customers || 0;
  });
  savePoolState();
  return result;
}

// ----- Right nav: panel drawers + recurring schedule -----

const RECURRING_KEY = 'ace.publish-schedule.v1';

function loadRecurringTasks() {
  try {
    const raw = localStorage.getItem(scheduleKeyFor(activeProfileId));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (error) {
    return [];
  }
}

function saveRecurringTasks(list) {
  try {
    localStorage.setItem(scheduleKeyFor(activeProfileId), JSON.stringify(list));
  } catch (error) {
    showToast('บันทึกกำหนดการไม่ได้ (พื้นที่เต็ม)', 'warning');
  }
}

function normalizeScheduleTask(task) {
  if (task && Array.isArray(task.slots) && task.slots.length) return task;
  const legacyTime = (task && task.time) || '11:00';
  return Object.assign({}, task, { slots: [{ time: legacyTime, per: 1 }] });
}

function nextRunFor(task, fromDate) {
  const now = fromDate || new Date();
  const slots = normalizeScheduleTask(task).slots
    .map(function(s) { return String(s.time || '09:00'); })
    .sort();
  for (let offset = 0; offset < 8; offset++) {
    const dow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset).getDay();
    if (task.days === 'weekdays' && (dow === 0 || dow === 6)) continue;
    if (task.days === 'weekend' && dow !== 0 && dow !== 6) continue;
    for (const hm of slots) {
      const parts = hm.split(':');
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, Number(parts[0]) || 0, Number(parts[1]) || 0, 0, 0);
      if (d > now) return d;
    }
  }
  return null;
}

function readSlotInputs() {
  const rows = Array.from(document.querySelectorAll('#slot-list .slot-row'));
  const seen = {};
  return rows.map(function(row) {
    const input = row.querySelector('.slot-time');
    return { time: (input && input.value) || '09:00', per: 1 };
  }).filter(function(s) {
    if (!/^\d{2}:\d{2}$/.test(s.time) || seen[s.time]) return false;
    seen[s.time] = true;
    return true;
  }).sort(function(a, b) { return a.time.localeCompare(b.time); });
}

function renderSlotInputs(slots) {
  const host = document.getElementById('slot-list');
  if (!host) return;
  const list = slots && slots.length ? slots : [{ time: '09:00', per: 1 }];
  host.innerHTML = list.map(function(s) {
    return '<div class="slot-row">' +
      '<input type="time" class="slot-time" value="' + escapeHtml(s.time || '09:00') + '">' +
      '<span class="muted small">1 คอนเทนต์</span>' +
      '<button type="button" class="slot-remove" aria-label="ลบรอบเวลานี้" title="ลบรอบเวลานี้">×</button>' +
      '</div>';
  }).join('');
  host.querySelectorAll('.slot-remove').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (host.querySelectorAll('.slot-row').length > 1) btn.closest('.slot-row').remove();
      else showToast('ต้องมีอย่างน้อย 1 รอบเวลา', 'warning');
    });
  });
}

function renderScheduleTasks() {
  const host = document.getElementById('recurring-list');
  if (!host) return;
  const list = loadRecurringTasks().map(normalizeScheduleTask);
  if (!list.length) {
    host.innerHTML = '<p class="muted small">ยังไม่มีโปรไฟล์ Schedule — เพิ่มด้านบน</p>';
    return;
  }
  const daysLabel = { daily: 'ทุกวัน', weekdays: 'จันทร์–ศุกร์', weekend: 'เสาร์–อาทิตย์' };
  host.innerHTML = list.map(function(task, index) {
    const next = nextRunFor(task);
    const slotsText = task.slots.map(function(s) { return '@' + s.time; }).join(' · ');
    return '<div class="recurring-row">' +
      '<div><b>' + escapeHtml(task.title) + '</b>' +
      '<div class="muted small">' + escapeHtml(daysLabel[task.days] || task.days) + ' · ' + task.slots.length + ' รอบ/วัน (รอบละ 1 คอนเทนต์)</div>' +
      '<div class="muted small">' + escapeHtml(slotsText) + '</div>' +
      (next ? '<div class="muted small">ครั้งถัดไป: ' + escapeHtml(next.toLocaleString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + '</div>' : '') +
      '</div>' +
      '<button type="button" class="btn btn-ghost btn-sm recurring-remove" data-index="' + index + '">ลบ</button>' +
      '</div>';
  }).join('');
  host.querySelectorAll('.recurring-remove').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const current = loadRecurringTasks();
      const removed = current.splice(Number(btn.dataset.index), 1)[0];
      saveRecurringTasks(current);
      renderScheduleTasks();
      showToast('ลบโปรไฟล์ “' + ((removed && removed.title) || '') + '” แล้ว', 'info');
    });
  });
}

function addRecurringTask() {
  const titleEl = document.getElementById('recurring-title');
  const daysEl = document.getElementById('recurring-days');
  const title = titleEl ? titleEl.value.trim() : '';
  if (!title) {
    showToast('ใส่ชื่อโปรไฟล์ช่องก่อนเพิ่ม Schedule', 'warning');
    if (titleEl) titleEl.focus();
    return;
  }
  const slots = readSlotInputs();
  if (!slots.length) {
    showToast('ตั้งรอบเวลาอย่างน้อย 1 รอบก่อนเพิ่ม Schedule', 'warning');
    return;
  }
  const list = loadRecurringTasks();
  list.push({
    title: title.slice(0, 80),
    slots: slots,
    days: (daysEl && daysEl.value) || 'daily',
    created_at: new Date().toISOString(),
  });
  saveRecurringTasks(list);
  if (titleEl) titleEl.value = '';
  renderSlotInputs(null);
  renderScheduleTasks();
  const next = nextRunFor(list[list.length - 1]);
  showToast('เพิ่มโปรไฟล์ Schedule แล้ว (' + slots.length + ' รอบ/วัน)' + (next ? ' — ครั้งถัดไป ' + next.toLocaleString('th-TH', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : ''), 'success');
}

/* Content Library and Actor Studio can widen into a full table view;
   the same button (or Esc) returns them to their drawer size. */
const EXPAND_PANELS = [
  { button: 'library-expand', panel: 'detail-library' },
  { button: 'actor-expand', panel: 'actor-overlay' }
];

function setPanelExpanded(panelId, expanded) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.classList.toggle('is-expanded', expanded);
  const pair = EXPAND_PANELS.filter(function(p) { return p.panel === panelId; })[0];
  const btn = pair && document.getElementById(pair.button);
  if (!btn) return;
  btn.setAttribute('aria-pressed', expanded ? 'true' : 'false');
  btn.textContent = expanded ? '⤡ ย่อ' : '⤢ ขยาย';
}

function bindExpandToggles() {
  EXPAND_PANELS.forEach(function(pair) {
    const btn = document.getElementById(pair.button);
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', function() {
      const panel = document.getElementById(pair.panel);
      setPanelExpanded(pair.panel, !(panel && panel.classList.contains('is-expanded')));
    });
  });
  if (document.body.dataset.expandBound === '1') return;
  document.body.dataset.expandBound = '1';
  document.addEventListener('keydown', function(event) {
    if (event.key !== 'Escape') return;
    EXPAND_PANELS.forEach(function(pair) { setPanelExpanded(pair.panel, false); });
  });
}

const DRAWER_IDS = {
  'schedule': 'drawer-schedule',
  'queue': 'drawer-queue',
  'content-library': 'detail-library',
  'source-library': 'drawer-source-library'
};

/* One owner for the right-hand drawers, so the rail, the Queue "Snap" button
   and the pool shortcuts open the same panel even when the rail is hidden. */
function openDrawer(key, forceOpen) {
  const targetId = DRAWER_IDS[key];
  const panel = targetId ? document.getElementById(targetId) : null;
  if (!panel) return null;
  const wasHidden = panel.classList.contains('hidden');
  Object.keys(DRAWER_IDS).forEach(function(name) {
    const other = document.getElementById(DRAWER_IDS[name]);
    if (other) other.classList.add('hidden');
  });
  document.querySelectorAll('.rail-btn[data-drawer]').forEach(function(btn) { btn.classList.remove('is-active'); });
  if (!wasHidden && !forceOpen) return panel;
  panel.classList.remove('hidden');
  const railBtn = document.querySelector('.rail-btn[data-drawer="' + key + '"]');
  if (railBtn) railBtn.classList.add('is-active');
  if (key === 'schedule') { renderSlotInputs(null); renderScheduleTasks(); }
  if (key === 'content-library' && typeof renderContentLibrary === 'function') renderContentLibrary();
  if (key === 'source-library' && typeof renderSourceLibrary === 'function') renderSourceLibrary();
  return panel;
}

/* Pool shortcuts: open the Source Library drawer and scroll to the block that
   holds the upload / Offers import, independent of the rail's visibility. */
/* The drawer only has a height once it is visible, so scroll on the next frame. */
function scrollToBlock(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;
  window.requestAnimationFrame(function() { target.scrollIntoView({ block: 'center' }); });
}

function openSourceDrawer(targetId) {
  if (document.body.dataset.stage !== 'research') switchStage('research');
  openDrawer('source-library', true);
  scrollToBlock(targetId);
}

/* ---------- Publish step: confirm channel + time, then queue ---------- */

function publishQueueEmptyHtml() {
  return '<p><b>ยังไม่มีรายการใน Publish Queue</b></p>' +
    '<p class="muted small">เลือกช่องทาง + เวลาด้านบน แล้วกด “ยืนยันแล้วส่งเข้า Publish Queue” — ACE ไม่โพสต์อัตโนมัติ</p>';
}

function isQueued(item) {
  return publishQueue.some(function(entry) {
    return (entry.libraryId && entry.libraryId === item.libraryId) || String(entry.id) === String(item.id);
  });
}

/* Sub_id scheme (owner): 1 = channel, 2 = the library entry the report joins on. */
function publishSubId2(item) {
  return item.libraryId || ('lib-' + item.id);
}

/* Stable key so a rendered card still points at its rows after a re-render. */
function publishKey(item) {
  return item.libraryId || String(item.id);
}

/* Which entry the Publish step acts on when nothing is ticked: the row picked
   in the table, otherwise the first approved item still waiting for a channel. */
function publishTargetIndex() {
  if (librarySelectedIndex >= 0 && contentLibrary[librarySelectedIndex]) return librarySelectedIndex;
  return contentLibrary.findIndex(function(item) { return item.status === 'APPROVE'; });
}

/* Ticked approved rows win (bulk confirm); otherwise the single active row. */
function publishTargets() {
  const ticked = contentLibrary.filter(function(item) { return item.selected && item.status === 'APPROVE'; });
  if (ticked.length) return ticked;
  const index = publishTargetIndex();
  return index >= 0 && contentLibrary[index] ? [contentLibrary[index]] : [];
}

function publishNoticeHtml(title, detail) {
  return '<div class="publish-empty">' +
    '<p><b>' + title + '</b></p>' +
    '<p class="muted small">' + detail + '</p>' +
    '<button type="button" class="btn btn-sm btn-primary go-finalize-btn">ไปที่ Finalize</button>' +
  '</div>';
}

function publishChannelCardsHtml(chosen, sub2) {
  return PUBLISH_CHANNELS.map(function(ch) {
    return '<label class="publish-channel">' +
      '<input type="checkbox" class="publish-channel-cb" value="' + ch.id + '"' +
        (chosen.indexOf(ch.id) !== -1 ? ' checked' : '') + '>' +
      '<span class="publish-channel-body">' +
        '<b>' + escapeHtml(ch.label) + (ch.note ? ' · ' + escapeHtml(ch.note) : '') + '</b>' +
        '<span>' + (channelHandle(ch.id) ? 'บัญชี: ' + escapeHtml(channelHandle(ch.id)) : 'ยังไม่ได้ผูกบัญชี') + '</span>' +
        '<span>Sub_id: ?sub_id1=' + ch.id + '&amp;sub_id2=' + escapeHtml(sub2) + '</span>' +
      '</span>' +
    '</label>';
  }).join('');
}

function publishTargetHeadHtml(targets) {
  if (targets.length === 1) {
    const item = targets[0];
    const timestamp = (item.lineage && item.lineage.approvedSha256) || '';
    return '<b>' + escapeHtml(item.name || 'รายการ') + '</b>' +
      '<span class="status-badge status-approve">APPROVE</span>' +
      '<span class="muted small">v' + ((item.lineage && item.lineage.version) || 1) +
        ' · freeze ' + escapeHtml(timestamp.slice(0, 10) || '—') + '</span>';
  }
  const names = targets.slice(0, 4).map(function(item) { return escapeHtml(item.name || 'รายการ'); }).join(' · ');
  return '<b>ยืนยันพร้อมกัน ' + targets.length + ' รายการ</b>' +
    '<span class="status-badge status-approve">APPROVE</span>' +
    '<span class="muted small">' + names + (targets.length > 4 ? ' · และอีก ' + (targets.length - 4) : '') + '</span>';
}

/* Rendered whenever the Publish stage or the library table refreshes, so the
   card always shows the rows the operator is looking at. */
function renderPublishConfirm() {
  const host = document.getElementById('publish-confirm');
  if (!host) return;

  const targets = publishTargets();
  if (!targets.length) {
    host.innerHTML = publishNoticeHtml(
      'ยังไม่มีรายการให้เผยแพร่',
      'อนุมัติงานใน Finalize ก่อน (เลือกแถว → ตรวจ Full Screen → อนุมัติ) แล้วกลับมาเลือกช่องทางและเวลา'
    );
    return;
  }
  if (targets.length === 1 && targets[0].status !== 'APPROVE') {
    const item = targets[0];
    const detail = item.status === 'EXPORTED'
      ? 'รายการนี้ยืนยันเผยแพร่แล้วและอยู่ใน Publish Queue ด้านล่าง — เลือกแถวอื่นที่อนุมัติแล้วเพื่อยืนยันเพิ่ม'
      : 'ต้องอนุมัติ (APPROVE) ก่อนจึงจะยืนยันการเผยแพร่ได้ — ไปที่ Finalize เพื่อตรวจและอนุมัติ';
    host.innerHTML = publishNoticeHtml(
      escapeHtml(item.name || 'รายการ') + ' — สถานะ ' + escapeHtml(item.status || '—'),
      detail
    );
    return;
  }

  const first = targets[0];
  const candidate = candidatePool.filter(function(c) { return String(c.id) === String(first.id); })[0] || {};
  const saved = first.publishRecord || {};
  const scheduled = /^\d{4}-\d{2}-\d{2}T/.test(String(saved.scheduledAt || '')) ? String(saved.scheduledAt) : '';
  const bulk = targets.length > 1;

  host.innerHTML =
    '<div class="publish-target">' + publishTargetHeadHtml(targets) + '</div>' +
    '<div class="publish-channels">' +
      publishChannelCardsHtml(first.channels || candidate.channels || ['shopee_video'], publishSubId2(first)) +
    '</div>' +
    '<div class="publish-when">' +
      '<label>โหมด<select id="publish-mode" class="form-input">' +
        '<option value="schedule"' + (saved.mode === 'now' ? '' : ' selected') + '>ตั้งเวลา</option>' +
        '<option value="now"' + (saved.mode === 'now' ? ' selected' : '') + '>เผยแพร่ทันที (โพสต์ด้วยมือ)</option>' +
      '</select></label>' +
      '<label>วันที่<input type="date" id="publish-date" class="form-input" value="' +
        (scheduled ? scheduled.slice(0, 10) : new Date().toISOString().slice(0, 10)) + '"></label>' +
      '<label>เวลา<input type="time" id="publish-time" class="form-input" value="' +
        (scheduled ? scheduled.slice(11, 16) : '19:00') + '"></label>' +
    '</div>' +
    '<label class="publish-note">หมายเหตุ (ไม่บังคับ)' +
      '<input id="publish-notes" class="form-input" placeholder="เช่น รีวิวสั้น 20 วิ / โปร 11.11" value="' +
        escapeHtml(bulk ? '' : (saved.notes || first.exportNotes || '')) + '">' +
    '</label>' +
    '<div class="publish-actions">' +
      '<button type="button" class="btn btn-primary" id="publish-confirm-btn">' +
        (bulk ? 'ยืนยัน ' + targets.length + ' รายการแล้วส่งเข้า Publish Queue' : 'ยืนยันแล้วส่งเข้า Publish Queue') +
      '</button>' +
      '<button type="button" class="btn btn-ghost" id="publish-qc-btn">ตรวจ Full Screen ก่อน</button>' +
      '<span class="muted small">' +
        (bulk ? 'ช่องทาง/เวลาเดียวกันทุกแถว' : 'ติ๊กหลายแถวใน Content Library เพื่อยืนยันพร้อมกัน') +
        ' — ACE ไม่โพสต์อัตโนมัติ</span>' +
    '</div>';

  const modeEl = document.getElementById('publish-mode');
  const dateEl = document.getElementById('publish-date');
  const timeEl = document.getElementById('publish-time');
  const syncMode = function() {
    const instant = modeEl.value === 'now';
    dateEl.disabled = instant;
    timeEl.disabled = instant;
  };
  modeEl.addEventListener('change', syncMode);
  syncMode();

  const firstIndex = contentLibrary.indexOf(first);
  document.getElementById('publish-qc-btn').addEventListener('click', function() { openQcOverlay(firstIndex); });
  document.getElementById('publish-confirm-btn').addEventListener('click', function() {
    confirmPublish(targets.map(publishKey));
  });
}

function confirmPublish(targetKeys) {
  const items = targetKeys.map(function(key) {
    return contentLibrary.filter(function(entry) { return publishKey(entry) === key; })[0];
  }).filter(function(entry) { return entry && entry.status === 'APPROVE'; });
  if (!items.length) {
    showToast('รายการต้องอนุมัติ (APPROVE) ก่อนจึงจะเผยแพร่ได้', 'warning');
    return;
  }
  const channels = Array.from(document.querySelectorAll('.publish-channel-cb:checked')).map(function(cb) { return cb.value; });
  if (!channels.length) {
    showToast('เลือกอย่างน้อย 1 ช่องทางก่อนยืนยัน', 'warning');
    return;
  }
  const mode = document.getElementById('publish-mode').value;
  const date = document.getElementById('publish-date').value;
  const time = document.getElementById('publish-time').value;
  if (mode === 'schedule' && (!date || !time)) {
    showToast('เลือกวันที่และเวลาก่อนยืนยัน', 'warning');
    return;
  }
  const notes = document.getElementById('publish-notes').value.trim();
  const scheduledAt = mode === 'now' ? new Date().toISOString() : date + 'T' + time;

  items.forEach(function(item) {
    item.status = 'EXPORTED';
    item.exportNotes = notes;
    item.channels = channels;
    item.selected = false;
    item.publishRecord = {
      channels: channels,
      mode: mode,
      scheduledAt: scheduledAt,
      notes: notes,
      subId1: channels[0],
      subId2: publishSubId2(item),
      approvedSha256: item.lineage ? (item.lineage.approvedSha256 || null) : null,
      version: item.lineage ? (item.lineage.version || null) : null,
      publishedAt: new Date().toISOString()
    };
    if (item.lineage) {
      item.lineage.status = 'PUBLISHED';
      item.lineage.publishedAt = item.publishRecord.publishedAt;
      pushLineageEvent(item, 'ยืนยันเผยแพร่: ' + channels.join(', ') +
        ' · ' + (mode === 'now' ? 'ทันที' : scheduledAt), { channels: channels });
    }
    if (!isQueued(item)) publishQueue.push(item);
  });

  savePoolState();
  renderContentLibrary();
  renderPublishQueue();
  showToast('ส่งเข้า Publish Queue แล้ว — ' + items.length + ' รายการ · ' + channels.length + ' ช่องทาง', 'success');
}

/* The row action and the library toolbar both land here instead of writing to
   the queue themselves, so channels + time are confirmed in exactly one place. */
function openPublishConfirm(index) {
  const item = contentLibrary[index];
  if (!item) return;
  if (item.status !== 'APPROVE') {
    showToast('รายการต้องอนุมัติ (APPROVE) ก่อนส่งเข้า Publish Queue', 'warning');
    return;
  }
  librarySelectedIndex = index;
  if (document.body.dataset.stage !== 'schedule') switchStage('schedule');
  renderContentLibrary();
  showToast('เลือกช่องทาง + เวลา แล้วกด “ยืนยันแล้วส่งเข้า Publish Queue”', 'info');
}

function bindPublishSchedule() {
  if (document.body.dataset.finalizeJumpBound === '1') return;
  document.body.dataset.finalizeJumpBound = '1';
  document.addEventListener('click', function(event) {
    if (!event.target.closest('.go-finalize-btn')) return;
    switchStage('finalize');
    showToast('เลือกงานใน Content Library แล้วกด “ตรวจ Full Screen” เพื่ออนุมัติ ก่อนกลับมา Publish', 'info');
  });
}

function bindSourceShortcuts() {
  [['pool-snap', 'snap-upload-area'], ['pool-offers', 'offers-import']].forEach(function(pair) {
    const btn = document.getElementById(pair[0]);
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', function() { openSourceDrawer(pair[1]); });
  });
}

function bindRightNav() {
  const rail = document.querySelector('.studio-rail');
  if (!rail || rail.dataset.navBound === '1') return;
  rail.dataset.navBound = '1';
  rail.querySelectorAll('[data-drawer]').forEach(function(btn) {
    btn.addEventListener('click', function() { openDrawer(btn.dataset.drawer); });
  });
  rail.querySelectorAll('[data-action="actors"]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const overlay = document.getElementById('actor-overlay');
      if (!overlay) return;
      if (overlay.classList.contains('hidden')) openActorStudio();
      else closeActorStudio();
    });
  });
  const addBtn = document.getElementById('recurring-add');
  if (addBtn) addBtn.addEventListener('click', addRecurringTask);
  const slotAdd = document.getElementById('slot-add');
  if (slotAdd) slotAdd.addEventListener('click', function() {
    const host = document.getElementById('slot-list');
    if (!host) return;
    const current = readSlotInputs();
    if (current.length >= 8) {
      showToast('สูงสุด 8 รอบต่อวัน', 'warning');
      return;
    }
    current.push({ time: '12:00', per: 1 });
    current.sort(function(a, b) { return a.time.localeCompare(b.time); });
    renderSlotInputs(current);
  });
  const queuePanel = document.getElementById('drawer-queue');
  if (queuePanel) queuePanel.classList.remove('hidden');
  const queueBtn = rail.querySelector('[data-drawer="queue"]');
  if (queueBtn) queueBtn.classList.add('is-active');
  renderScheduleTasks();
}

function copyContentDraft() {
  var candidateId = dom.contentDraftPanel ? parseInt(dom.contentDraftPanel.dataset.candidateId, 10) : NaN;
  var candidate = candidatePool.find(function(c) { return c.id === candidateId; });
  if (!lastDraft || !candidate) {
    setDraftStatus('ยังไม่มี Content ให้คัดลอก', 'error');
    return;
  }

  navigator.clipboard.writeText(draftAsText(candidate)).then(function() {
    showToast('คัดลอกชุดโพสต์แล้ว (caption + CTA + ลิงก์ + เช็กลิสต์)', 'success');
  }).catch(function() {
    setDraftStatus('คัดลอกไม่สำเร็จ — เบราว์เซอร์ไม่อนุญาตคลิปบอร์ด', 'error');
  });
}

function hideSnapWorkflow() {
  if (dom.snapWorkflow) dom.snapWorkflow.classList.add('hidden');
  hideAllSections();
}

// ----- Actor Studio -----
function addActorRow() {
  if (dom.actorStudio) {
    var html = `
      <div class="actor-card">
        <input type="text" placeholder="ชื่อนักแสดง" class="actor-name">
        <input type="text" placeholder="@username" class="actor-handle">
        <select class="actor-platform">
          <option value="Shopee">Shopee</option>
          <option value="Lazada">Lazada</option>
          <option value="TikTok">TikTok</option>
        </select>
        <button type="button" class="btn btn-danger btn-remove-actor">ลบ</button>
      </div>
    `;
    if (dom.actorStudio.querySelector('.actor-grid')) {
      dom.actorStudio.querySelector('.actor-grid').insertAdjacentHTML('beforeend', html);
    }
  }
}

function hideActorStudio() {
  if (dom.actorStudio) dom.actorStudio.classList.add('hidden');
  hideAllSections();
}

// ----- Content Library -----
function renderContentLibraryStart() {
  var tbody = dom.libraryTableBody;
  if (!tbody) return;

  if (!contentLibrary || contentLibrary.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="muted">ไม่มีรายการในคลัง</td></tr>';
    if (dom.libraryCount) dom.libraryCount.textContent = '0 / 0 รายการ';
    return;
  }

  var html = contentLibrary.map(function(item, i) {
    var statusClass = 'status-' + item.status.toLowerCase();
    var qualityClass = 'quality-' + (item.qualityScore || 'medium').toLowerCase();
    var btnDisabled = item.status === 'EXPORTED' ? 'disabled' : '';

    // Daily Loop: เลือกแถว = Active Lineage → อนุมัติ (freeze ไฟล์) → Publish Queue.
    // QC opens from the toolbar so the row stays a plain selector.
    var actionHtml = '';
    if (item.status === 'PENDING') {
      actionHtml = `
        <button class="btn btn-ghost btn-sm reject-row" data-index="${i}" ${btnDisabled}>ปฏิเสธ</button>
      `;
    } else if (item.status === 'ACTIVE') {
      actionHtml = `
        <button class="btn btn-primary btn-sm approve-row" data-index="${i}" ${btnDisabled}>อนุมัติ</button>
        <button class="btn btn-ghost btn-sm request-changes-row" data-index="${i}" ${btnDisabled}>สั่งแก้ไข</button>
      `;
    } else if (item.status === 'APPROVE') {
      actionHtml = `
        <button class="btn btn-primary btn-sm set-active-row" data-index="${i}" ${btnDisabled}>ส่งเข้า Publish Queue</button>
        <button class="btn btn-ghost btn-sm reject-row" data-index="${i}" ${btnDisabled}>ยกเลิกการอนุมัติ</button>
      `;
    } else if (item.status === 'REJECT') {
      actionHtml = `
        <button class="btn btn-primary btn-sm approve-row" data-index="${i}" ${btnDisabled}>โอนเป็น PENDING</button>
        <button class="btn btn-ghost btn-sm" data-index="${i}" ${btnDisabled}>ลบรายการ</button>
      `;
    } else if (item.status === 'EXPORTED') {
      actionHtml = '<span class="muted">เผยแพร่แล้ว</span>';
    }
    var rowClass = 'library-row' + (i === librarySelectedIndex ? ' is-selected' : '');

    return `
      <tr class="${rowClass}" data-index="${i}">
        <td><input type="checkbox" class="row-checkbox" ${item.status === 'EXPORTED' ? 'disabled' : ''} /></td>
        <td>${item.libraryId || '--'}</td>
        <td>
          <div class="ellipsis" title="${item.name || ''}">${item.name || '--'}</div>
          ${item.lineage ? `<div class="muted small lineage-line">v${item.lineage.version || 1}${item.lineage.renderedAt ? ' · ' + new Date(item.lineage.renderedAt).toLocaleDateString('th-TH') : ''} · ${Math.round((item.lineage.bytes || 0) / 1024)} KB${item.lineage.sha256 ? ' · ' + String(item.lineage.sha256).slice(0, 8) + '…' : ''}</div>` : ''}
        </td>
        <td>${item.platform || '--'}</td>
        <td><span class="status-badge ${statusClass}">${item.status}</span></td>
        <td><span class="quality-badge ${qualityClass}">${item.qualityScore || '—'}</span></td>
        <td>
          ${actionHtml}
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = html;

  // Attach event handlers after render
  attachLibraryHandlers();

  // Update count
  if (dom.libraryCount) {
    var total = contentLibrary.length;
    var visible = contentLibrary.filter(function(item, idx) {
      var status = dom.libraryStatusFilter ? dom.libraryStatusFilter.value : '';
      return !status || itemStatusMatches(idx, status);
    }).length;
    dom.libraryCount.textContent = visible + ' / ' + total + ' รายการ';
  }
}

// ----- Content Library Helpers -----
function filterLibraryByStatus() {
  if (dom.libraryStatusFilter) {
    renderContentLibrary();
  }
}

function toggleSelectAll() {
  if (dom.selectAllLib) {
    var checked = dom.selectAllLib.checked;
    document.querySelectorAll('.row-checkbox').forEach(function(cb) {
      cb.checked = checked;
      var index = parseInt(cb.closest('tr').dataset.index, 10);
      if (index >= 0 && index < contentLibrary.length) {
        contentLibrary[index].selected = checked;
      }
    });
    updateLibraryCount();
    renderPublishConfirm();
  }
}

function updateLibraryCount() {
  if (!dom.libraryCount) return;
  var total = contentLibrary.length;
  var selected = contentLibrary.filter(function(item) { return item.selected; }).length;
  dom.libraryCount.textContent = selected + ' / ' + total + ' รายการ';
}

/* Row click = pick the lineage to work on. A PENDING row becomes ACTIVE (the
   old per-row button), anything else just becomes the selected row. */
function selectLibraryRow(index) {
  const item = contentLibrary[index];
  if (!item) return;
  librarySelectedIndex = index;
  if (item.status === 'PENDING') {
    item.status = 'ACTIVE';
    if (!item.lineage) item.lineage = { version: 0, history: [] };
    item.lineage.status = 'ACTIVE';
    pushLineageEvent(item, 'เลือกแถวนี้เป็น Active Lineage');
    savePoolState();
    renderContentLibrary();
    showToast('ตั้งเป็น Active Lineage แล้ว — กด “ตรวจ Full Screen” เพื่อตรวจละเอียด', 'success');
    return;
  }
  renderContentLibrary();
  showToast('เลือก “' + item.name + '” เป็นรายการทำงาน', 'info');
}

/* Library toolbar: takes the checked approved row to the Publish step, where the
   channels and time are confirmed (this button never queues by itself). */
function setActiveLineage() {
  var index = contentLibrary.findIndex(function(item) {
    return item.selected && item.status === 'APPROVE';
  });
  if (index < 0) {
    showToast('กรุณาเลือกรายการที่มีสถานะ APPROVE ก่อน', 'warning');
    return;
  }
  openPublishConfirm(index);
}

// ----- Toast -----

function showToast(message, type) {
  if (!dom.toast) return;
  dom.toast.textContent = message;
  dom.toast.className = 'toast is-visible' + (type === 'error' ? ' is-error' : '');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(function() {
    dom.toast.className = 'toast';
  }, 3200);
}

// ----- Source Library -----

let sourceItems = [];

// ----- Shopee Affiliate menu launchers -----
// ACE cannot open Shopee's own menus for you: those pages need your logged-in
// session and Shopee blocks automated navigation. These are one-click shortcuts
// that open the real pages in your browser, where you stay signed in.

const SHOPEE_MENUS = [
  { id: 'dashboard', label: '\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e41\u0e2a\u0e14\u0e07\u0e1c\u0e25', path: '/dashboard' },
  { id: 'product_offer', label: '\u0e02\u0e49\u0e2d\u0e40\u0e2a\u0e19\u0e2d \u0e1c\u0e25\u0e34\u0e15\u0e20\u0e31\u0e13\u0e11\u0e4c', path: '/offer/product_offer' },
  { id: 'product_feed', label: 'Feed \u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32', path: '/creative/product_feed' },
  { id: 'open_api', label: '\u0e40\u0e1b\u0e34\u0e14 API', path: '/open_api' },
];

const SHOPEE_ORIGIN = 'https://affiliate.shopee.co.th';

function renderShopeeMenus() {
  const host = document.getElementById('shopee-menus');
  if (!host) return;
  host.innerHTML = SHOPEE_MENUS.map(function(menu) {
    return '<a class="shopee-menu" href="' + SHOPEE_ORIGIN + menu.path + '" target="_blank" rel="noopener noreferrer">' +
      escapeHtml(menu.label) + '</a>';
  }).join('') +
    '<span class="muted small shopee-menu-note">\u0e40\u0e21\u0e19\u0e39\u0e2d\u0e37\u0e48\u0e19 (\u0e02\u0e49\u0e2d\u0e40\u0e2a\u0e19\u0e2d Shopee / \u0e23\u0e49\u0e32\u0e19\u0e04\u0e49\u0e32 / \u0e1e\u0e34\u0e40\u0e28\u0e29 / \u0e41\u0e04\u0e21\u0e40\u0e1b\u0e0d) \u0e40\u0e1b\u0e34\u0e14\u0e08\u0e32\u0e01\u0e41\u0e16\u0e1a\u0e0b\u0e49\u0e32\u0e22\u0e43\u0e19\u0e2b\u0e19\u0e49\u0e32 Shopee \u2014 ACE \u0e40\u0e1b\u0e34\u0e19\u0e41\u0e2d\u0e1b\u0e17\u0e35\u0e48\u0e23\u0e31\u0e19\u0e1a\u0e19\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e04\u0e38\u0e13 \u0e08\u0e36\u0e07\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e2b\u0e19\u0e49\u0e32\u0e40\u0e2b\u0e25\u0e48\u0e32\u0e19\u0e31\u0e49\u0e19\u0e41\u0e17\u0e19\u0e04\u0e38\u0e13\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49</span>';
}

function bindSourceLibraryRemove() {
  if (document.body.dataset.sourceRemoveBound === '1') return;
  document.body.dataset.sourceRemoveBound = '1';
  document.addEventListener('click', function(event) {
    const button = event.target.closest('[data-source-remove]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const index = Number(button.dataset.sourceRemove);
    const removed = sourceItems[index];
    if (!removed) return;
    sourceItems.splice(index, 1);
    renderSourceLibrary();
    showToast('ลบ “' + removed.name + '” ออกจาก Source Library แล้ว', 'info');
  });
}

function renderSourceLibrary() {
  savePoolState();
  renderShopeeMenus();
  var grids = document.querySelectorAll('.source-library-grid');
  if (!grids.length) return;

  grids.forEach(function(grid) {
    if (!sourceItems.length) {
      grid.innerHTML = '<div class="empty-state">ยังไม่มีไฟล์แหล่งที่มา</div>';
      return;
    }
    var seen = {};
    var unique = sourceItems.filter(function(item) {
      var key = [String(item.name || '').trim().toLowerCase(), String(item.url || '').trim().toLowerCase()].join('|');
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });

    grid.innerHTML = unique.map(function(item) {
      var index = sourceItems.indexOf(item);
      var open = item.url
        ? '<a class="source-open" href="' + item.url + '" target="_blank" rel="noopener noreferrer" title="\u0e40\u0e1b\u0e34\u0e14\u0e25\u0e34\u0e07\u0e01\u0e4c">\u2197</a>'
        : '';
      return '<div class="source-card">' +
        '<div class="card-header">' +
          '<span class="card-title">' + item.name + '</span>' +
          '<span class="card-actions-badges">' +
            '<span class="status-badge ' + (item.badgeClass || 'status-draft') + '">' + item.kind + '</span>' +
            open +
            '<button type="button" class="source-remove" data-source-remove="' + index +
            '" title="\u0e25\u0e1a\u0e41\u0e2b\u0e25\u0e48\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e19\u0e35\u0e49" aria-label="\u0e25\u0e1a">\u00d7</button>' +
          '</span>' +
        '</div>' +
        '<p class="muted mono small">' + (item.detail || '') + '</p>' +
      '</div>';
    }).join('');
  });
}

function seedSourceLibraryFromPool() {
  if (sourceItems.length) { renderSourceLibrary(); return; }
  sourceItems = candidatePool.map(function(c) {
    return {
      name: c.name,
      kind: c.platform,
      detail: c.evidence || '',
      badgeClass: 'status-approved'
    };
  });
  renderSourceLibrary();
  showToast('โหลด Source Library ' + sourceItems.length + ' รายการเรียบร้อย', 'success');
}

function addManualSource() {
  var host = document.getElementById('manual-source-form');
  if (!host) {
    var button = document.getElementById('add-manual');
    var section = button ? button.closest('.studio-panel') : null;
    if (!section) return;
    host = document.createElement('div');
    host.id = 'manual-source-form';
    host.className = 'manual-source-form';
    host.innerHTML = '<input type="text" id="manual-source-name" placeholder="ชื่อแหล่งข้อมูล">' +
      '<input type="url" id="manual-source-url" placeholder="https://affiliate.shopee.co.th/...">' +
      '<button type="button" class="btn btn-sm btn-primary" id="manual-source-save">บันทึก</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" id="manual-source-cancel">ยกเลิก</button>';
    section.insertBefore(host, section.querySelector('.source-library-grid'));

    host.querySelector('#manual-source-cancel').addEventListener('click', function() { host.remove(); });
    host.querySelector('#manual-source-save').addEventListener('click', saveManualSource);
    host.querySelector('#manual-source-url').addEventListener('keydown', function(event) {
      if (event.key === 'Enter') saveManualSource();
    });
  }
  var nameField = document.getElementById('manual-source-name');
  if (nameField) nameField.focus();
}

function saveManualSource() {
  var nameField = document.getElementById('manual-source-name');
  var urlField = document.getElementById('manual-source-url');
  var name = nameField ? nameField.value.trim() : '';
  var url = urlField ? urlField.value.trim() : '';
  if (!name) { showToast('ใส่ชื่อแหล่งข้อมูลก่อน', 'warning'); return; }
  if (url && !/^https?:\/\//i.test(url)) { showToast('ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://', 'warning'); return; }

  var duplicate = sourceItems.some(function(item) {
    return String(item.name || '').trim().toLowerCase() === name.toLowerCase()
      && String(item.url || '').trim().toLowerCase() === url.toLowerCase();
  });
  if (duplicate) {
    var form = document.getElementById('manual-source-form');
    if (form) form.remove();
    showToast('มีแหล่งข้อมูลนี้อยู่แล้ว — ไม่เพิ่มซ้ำ', 'warning');
    return;
  }

  sourceItems.push({
    name: name,
    kind: 'MANUAL',
    detail: url || 'เพิ่มด้วยมือ',
    url: url,
    badgeClass: 'status-pending'
  });
  var host = document.getElementById('manual-source-form');
  if (host) host.remove();
  renderSourceLibrary();
  showToast('เพิ่ม Source เรียบร้อย' + (url ? ' — กดการ์ดเพื่อเปิดลิงก์' : ''), 'success');
}

// ----- Shopee product link import -----

let linkPreview = null;
const ESTIMATED_COMMISSION_RATE = 0.05;

function setLinkStatus(message, kind) {
  if (!dom.linkImportStatus) return;
  dom.linkImportStatus.textContent = message;
  dom.linkImportStatus.className = 'muted small' +
    (kind === 'error' ? ' link-import-status-error' : kind === 'ok' ? ' link-import-status-ok' : '');
}

function suggestCommission() {
  if (!dom.linkCommission || !dom.linkPrice) return;
  if (dom.linkCommission.dataset.touched === 'true') return;
  var price = parseFloat(dom.linkPrice.value);
  dom.linkCommission.value = price > 0 ? (price * ESTIMATED_COMMISSION_RATE).toFixed(2) : '';
}

function showLinkPreview(data) {
  if (!dom.linkImportPreview) return;
  dom.linkImportPreview.classList.remove('hidden');

  var fallbackName = data.itemId ? 'Shopee item ' + data.itemId : '';
  if (dom.linkName) dom.linkName.value = data.title || fallbackName;
  if (dom.linkPrice) dom.linkPrice.value = data.price === null || data.price === undefined ? '' : data.price;
  if (dom.linkCommission) {
    dom.linkCommission.dataset.touched = 'false';
    dom.linkCommission.value = '';
  }
  suggestCommission();

  if (dom.linkImportImage) {
    if (data.image) {
      dom.linkImportImage.src = data.image;
      dom.linkImportImage.hidden = false;
    } else {
      dom.linkImportImage.removeAttribute('src');
      dom.linkImportImage.hidden = true;
    }
  }

  if (data.fetched && (data.title || data.price !== null)) {
    setLinkStatus('ดึงข้อมูลสำเร็จ' + (data.title ? ': ' + data.title : '') +
      (data.price ? ' • ฿' + data.price : ' • ไม่พบราคาบนหน้าเว็บ'), 'ok');
  } else if (data.fetched) {
    setLinkStatus('เปิดหน้าเว็บได้แต่ไม่พบข้อมูลสินค้า (หน้านี้โหลดด้วย JavaScript) — กรอกชื่อและราคาเองแล้วกดเพิ่มได้เลย', 'error');
  } else {
    setLinkStatus('Shopee ไม่ได้ส่งข้อมูลกลับมา (' + (data.reason || 'blocked') +
      ') — กรอกชื่อและราคาเองแล้วกดเพิ่มได้เลย', 'error');
  }
}

async function fetchProductFromLink() {
  var url = dom.productUrl ? dom.productUrl.value.trim() : '';
  if (!url) {
    setLinkStatus('วางลิงก์สินค้า Shopee ก่อนครับ', 'error');
    return;
  }

  setLinkStatus('กำลังดึงข้อมูลจากลิงก์…', null);
  if (dom.fetchProduct) dom.fetchProduct.disabled = true;

  try {
    var response = await fetch('/api/mvp/products/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url })
    });

    var data = await response.json().catch(function() { return null; });
    if (!response.ok) {
      setLinkStatus((data && data.error) ? data.error : 'ดึงข้อมูลไม่สำเร็จ (HTTP ' + response.status + ')', 'error');
      return;
    }

    linkPreview = data;
    showLinkPreview(data);
  } catch (error) {
    setLinkStatus('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ' + error.message, 'error');
  } finally {
    if (dom.fetchProduct) dom.fetchProduct.disabled = false;
  }
}

function addLinkProductToPools() {
  if (!linkPreview) {
    setLinkStatus('กด “ดึงข้อมูล” จากลิงก์ก่อน แล้วค่อยเพิ่มเข้าคลัง', 'error');
    return;
  }

  var name = dom.linkName ? dom.linkName.value.trim() : '';
  if (!name) {
    setLinkStatus('กรอกชื่อสินค้าก่อนเพิ่มเข้าคลัง', 'error');
    return;
  }

  var price = dom.linkPrice ? parseFloat(dom.linkPrice.value) : 0;
  if (!isFinite(price) || price < 0) price = 0;

  var commission = dom.linkCommission ? parseFloat(dom.linkCommission.value) : 0;
  if (!isFinite(commission) || commission < 0) commission = 0;

  var quality = commission >= 100 ? 'High' : commission >= 40 ? 'Medium' : 'Low';
  var link = linkPreview.finalUrl || linkPreview.url;
  var idParts = linkPreview.shopId && linkPreview.itemId
    ? ' • shop ' + linkPreview.shopId + ' / item ' + linkPreview.itemId
    : '';

  var product = {
    id: candidatePool.length + 1,
    name: name,
    platform: 'Shopee',
    affiliateLink: link,
    quality: quality,
    status: 'DRAFT',
    views: 0,
    clicks: 0,
    estimatedSale: 0,
    commission: commission,
    price: price,
    evidence: 'ลิงก์ Shopee (อ่านจากหน้าเว็บ: ' + (linkPreview.fetched ? 'สำเร็จ' : 'ไม่สำเร็จ') + ')' + idParts
  };

  candidatePool.push(product);
  contentLibrary.push({
    ...product,
    libraryId: 'lib-' + product.id,
    status: 'PENDING',
    qualityScore: quality
  });

  sourceItems.push({
    name: name,
    kind: 'SHOPEE',
    detail: (price > 0 ? '฿' + price.toFixed(2) : 'ยังไม่ทราบราคา') +
      (commission > 0 ? ' • คอมมิชชัน ฿' + commission.toFixed(2) : ' • ยังไม่ระบุคอมมิชชัน') + idParts,
    badgeClass: linkPreview.fetched ? 'status-approved' : 'status-pending'
  });

  renderCandidatePool();
  renderContentLibrary();
  renderSourceLibrary();
  showToast('เพิ่ม “' + name + '” เข้า Source Library และ Candidate Pool เรียบร้อย', 'success');
  setLinkStatus('เพิ่มสินค้าเข้า Source Library + Candidate Pool แล้ว', 'ok');

  linkPreview = null;
  if (dom.linkImportPreview) dom.linkImportPreview.classList.add('hidden');
  if (dom.productUrl) dom.productUrl.value = '';
}

// ----- Library helpers -----

function seedContentLibraryFromPool() {
  if (contentLibrary.length || !candidatePool.length) return;
  candidatePool.slice(0, 8).forEach(function(c) {
    contentLibrary.push(Object.assign({}, c, {
      libraryId: 'lib-' + c.id,
      status: 'PENDING',
      qualityScore: c.quality,
    }));
  });
}

function renderContentLibrary() {
  savePoolState();
  renderContentLibraryStart();
  // Keep the Publish step pointed at the same row after any library change.
  if (document.getElementById('publish-confirm')) renderPublishConfirm();
}

function itemStatusMatches(index, filterStatus) {
  var item = contentLibrary[index];
  if (!item) return false;
  if (!filterStatus) return true;
  if (filterStatus === '') return true;
  if (filterStatus === 'DRAFT') return item.status === 'PENDING' || item.status === 'APPROVE';
  if (filterStatus === 'REVIEW') return item.status === 'PENDING' || item.status === 'ACTIVE' || item.status === 'REJECT';
  if (filterStatus === 'FINALIZED') return item.status === 'APPROVE' || item.status === 'EXPORTED';
  if (filterStatus === 'EXPORTED') return item.status === 'EXPORTED';
  return item.status === filterStatus;
}

function channelLabel(id) {
  const found = PUBLISH_CHANNELS.find(function(ch) { return ch.id === id; });
  return found ? found.label : id;
}

/* The confirmed plan of one queued row, so the upcoming schedule is readable
   from the queue itself instead of only inside the Publish card. */
function publishWhenLabel(record) {
  if (!record || !record.scheduledAt) return 'ยังไม่ตั้งเวลา';
  const when = new Date(record.scheduledAt);
  if (isNaN(when.getTime())) return String(record.scheduledAt);
  const stamp = when.toLocaleString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  return record.mode === 'now' ? 'เผยแพร่ทันที · ' + stamp : stamp;
}

function publishChannelsLabel(record, item) {
  const ids = (record && record.channels && record.channels.length) ? record.channels : (item.channels || []);
  return ids.map(channelLabel).join(' · ') || '—';
}

/* Sort key for the queue view: nearest slot first, rows without a time last. */
function publishSortTime(item) {
  const time = new Date((item.publishRecord || {}).scheduledAt || '').getTime();
  return isNaN(time) ? Infinity : time;
}

/* A confirmed slot that is already in the past has not been posted yet. */
function publishIsOverdue(item) {
  const time = publishSortTime(item);
  return time !== Infinity && time < Date.now();
}

function renderPublishQueue() {
  savePoolState();
  var list = document.getElementById('publish-queue');
  if (!list) return;
  if (!publishQueue.length) {
    list.innerHTML = '<li class="publish-empty">' + publishQueueEmptyHtml() + '</li>';
    return;
  }
  // Nearest slot first; data-index keeps pointing at publishQueue, not this view.
  const ordered = publishQueue
    .map(function(item, index) { return { item: item, index: index }; })
    .sort(function(a, b) { return publishSortTime(a.item) - publishSortTime(b.item); });

  list.innerHTML = ordered.map(function(entry, i) {
    const item = entry.item;
    const record = item.publishRecord || {};
    const overdue = publishIsOverdue(item);
    return '<li class="queue-item' + (overdue ? ' is-overdue' : '') + '">' +
      '<span class="queue-index">' + (i + 1) + '</span>' +
      '<span class="queue-title">' +
        '<b>' + escapeHtml(item.name) +
          (overdue ? ' <span class="queue-flag">เลยกำหนด</span>' : '') + '</b>' +
        '<span class="queue-meta">🗓 ' + escapeHtml(publishWhenLabel(record)) +
          ' · ช่องทาง: ' + escapeHtml(publishChannelsLabel(record, item)) + '</span>' +
        (item.exportNotes ? '<span class="queue-meta">' + escapeHtml(item.exportNotes) + '</span>' : '') +
      '</span>' +
      (item.affiliateLink
        ? '<button type="button" class="chip-btn pq-copy" data-index="' + entry.index + '">คัดลอกลิงก์</button>'
        : '') +
    '</li>';
  }).join('');

  if (list.dataset.bound !== '1') {
    list.dataset.bound = '1';
    list.addEventListener('click', function(event) {
      const copyBtn = event.target.closest('.pq-copy');
      if (!copyBtn) return;
      const entry = publishQueue[Number(copyBtn.dataset.index)];
      if (!entry || !entry.affiliateLink) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(entry.affiliateLink)
          .then(function() { showToast('คัดลอกลิงก์แล้ว — โพสต์ด้วยมือตามช่องทางที่เลือก', 'success'); })
          .catch(function() { showToast('คัดลอกไม่สำเร็จ — คัดลอกจากข้อมูลสินค้าแทน', 'warning'); });
      } else {
        showToast(entry.affiliateLink, 'info');
      }
    });
  }
}

// ----- Dashboard -----

function itemPerfHistory(holder) {
  if (!holder) return [];
  if (Array.isArray(holder.perfHistory) && holder.perfHistory.length) return holder.perfHistory;
  return holder.perf ? [holder.perf] : [];
}

function collectPerfEntries() {
  const entries = [];
  const pushFrom = function(name, holder) {
    itemPerfHistory(holder).forEach(function(h) {
      const date = h.date || (h.imported_at || '').slice(0, 10);
      if (!date) return;
      entries.push({ name: name, platform: h.platform || holder.platform || 'ไม่ระบุ', date: date, commission: h.commission_thb || 0 });
    });
  };
  contentLibrary.forEach(function(item) { pushFrom(item.name, item); });
  candidatePool.forEach(function(c) {
    // A library entry may carry a legacy id (`lib-<timestamp>-<random>`), so
    // match on either form before counting the candidate a second time.
    const hasLib = contentLibrary.some(function(it) {
      const sameItem = it.libraryId === 'lib-' + c.id || String(it.id) === String(c.id);
      return sameItem && (it.perfHistory || it.perf);
    });
    if (!hasLib) pushFrom(c.name, c);
  });
  return entries;
}

function computeRevenueWindows(entries) {
  const now = new Date();
  const fmt = function(d) { return d.toISOString().slice(0, 10); };
  const starts = { day: fmt(now), week: fmt(new Date(now.getTime() - 6 * 86400000)), month: fmt(new Date(now.getTime() - 29 * 86400000)) };
  const win = { day: { revenue: 0, contents: {}, channels: {} }, week: { revenue: 0, contents: {}, channels: {} }, month: { revenue: 0, contents: {}, channels: {} } };
  entries.forEach(function(e) {
    ['day', 'week', 'month'].forEach(function(k) {
      if (e.date < starts[k]) return;
      const w = win[k];
      w.revenue += e.commission;
      w.contents[e.name] = true;
      w.channels[e.platform] = (w.channels[e.platform] || 0) + e.commission;
    });
  });
  ['day', 'week', 'month'].forEach(function(k) {
    const w = win[k];
    w.contentCount = Object.keys(w.contents).length;
    w.channelCount = Object.keys(w.channels).length;
    w.avgPerContent = w.contentCount ? w.revenue / w.contentCount : 0;
    w.avgPerChannel = w.channelCount ? w.revenue / w.channelCount : 0;
  });
  return win;
}

function renderRevenueWindows(entries) {
  const win = computeRevenueWindows(entries);
  const titles = { day: 'วันนี้', week: '7 วันล่าสุด', month: '30 วันล่าสุด' };
  const thb = function(v) { return '฿' + v.toLocaleString('th-TH', { maximumFractionDigits: 2 }); };
  ['day', 'week', 'month'].forEach(function(k) {
    const w = win[k];
    const host = document.getElementById('rev-' + k);
    if (!host) return;
    host.innerHTML = '<div class="rev-window-title">' + titles[k] + '</div>' +
      '<div class="rev-big">' + thb(w.revenue) + '</div>' +
      '<div class="rev-line">เฉลี่ย / 1 คอนเทนต์: ' + thb(w.avgPerContent) + ' (' + w.contentCount + ' ชิ้น)</div>' +
      '<div class="rev-line">เฉลี่ย / ช่องทาง: ' + thb(w.avgPerChannel) + ' (' + w.channelCount + ' ช่องทาง)</div>';
  });
  const table = document.getElementById('channel-rev-tbody');
  if (table) {
    const channels = {};
    ['day', 'week', 'month'].forEach(function(k) { Object.keys(win[k].channels).forEach(function(c) { channels[c] = true; }); });
    const names = Object.keys(channels).sort();
    table.innerHTML = names.length
      ? names.map(function(c) {
          return '<tr><td>' + escapeHtml(c) + '</td>' +
            '<td class="perf-num">' + thb(win.day.channels[c] || 0) + '</td>' +
            '<td class="perf-num">' + thb(win.week.channels[c] || 0) + '</td>' +
            '<td class="perf-num">' + thb(win.month.channels[c] || 0) + '</td></tr>';
        }).join('')
      : '<tr><td colspan="4" class="muted">ยังไม่มีรายได้ตามช่องทาง — นำเข้าหลักฐานหลายวันเพื่อดูแนวโน้ม</td></tr>';
  }
}

function renderDashboard() {
  const rows = collectPerfRows();
  const entries = collectPerfEntries();
  const stats = rows.reduce(function(acc, r) {
    acc.clicks += r.perf.clicks || 0;
    acc.orders += r.perf.orders || 0;
    acc.commission += r.perf.commission_thb || 0;
    acc.estimated += r.perf.commission_estimated_thb || 0;
    acc.invalid += r.perf.invalid_clicks || 0;
    acc.newCustomers += r.perf.new_customers || 0;
    return acc;
  }, { clicks: 0, orders: 0, commission: 0, estimated: 0, invalid: 0, newCustomers: 0 });
  dashboardData.totalSales = stats.orders;
  dashboardData.totalClicks = stats.clicks;
  dashboardData.totalCommission = stats.commission;
  const setNum = function(id, v, suffix) {
    const el = document.getElementById(id);
    if (el) el.textContent = v.toLocaleString('th-TH') + (suffix || '');
  };
  setNum('total-clicks', stats.clicks);
  setNum('total-orders', stats.orders);
  setNum('total-commission', stats.commission, ' THB');
  setNum('est-commission', stats.estimated, ' THB');
  setNum('invalid-clicks', stats.invalid);
  setNum('new-customers', stats.newCustomers);
  const tbody = document.getElementById('content-perf-tbody');
  if (tbody) {
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="10" class="muted">ยังไม่มีหลักฐานนำเข้า — โพสต์คลิปแล้วกรอกไฟล์ติดตามผลจากรายงาน Shopee แล้วนำเข้าที่นี่</td></tr>';
    } else {
      tbody.innerHTML = rows.map(function(r) {
        const p = r.perf;
        return '<tr>' +
          '<td>' + escapeHtml(r.name || '') + '</td>' +
          '<td>' + escapeHtml(p.platform || '—') + '</td>' +
          '<td class="perf-num">' + escapeHtml(p.sub_id || '—') + '</td>' +
          '<td class="perf-num">' + (p.views || 0).toLocaleString('th-TH') + '</td>' +
          '<td class="perf-num">' + (p.clicks || 0).toLocaleString('th-TH') + '</td>' +
          '<td class="perf-num">' + (p.orders || 0).toLocaleString('th-TH') + '</td>' +
          '<td class="perf-num">฿' + (p.commission_thb || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
          '<td class="perf-num">฿' + (r.revenueTotal || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
          '<td>' + (r.version ? 'v' + r.version : '—') + '</td>' +
          '<td class="perf-evidence">' + escapeHtml(p.imported_at ? new Date(p.imported_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + (p.source_file ? ' · ' + p.source_file : '') : '—') + '</td>' +
          '</tr>';
      }).join('');
    }
  }
  const top5 = document.getElementById('dashboard-top5');
  if (top5) {
    const ranked = rows.slice().sort(function(a, b) { return (b.revenueTotal || 0) - (a.revenueTotal || 0); }).slice(0, 5);
    top5.innerHTML = ranked.length
      ? ranked.map(function(r, i) {
          return '<div class="top5-row"><span class="top5-rank">' + (i + 1) + '</span>' +
            '<span class="top5-name">' + escapeHtml(r.name || '') + '</span>' +
            '<span class="top5-value">฿' + (r.revenueTotal || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 }) + '</span></div>';
        }).join('')
      : '<p class="muted small">ยังไม่มีข้อมูลนำเข้า</p>';
  }
  renderRevenueWindows(entries);
  drawTrendChart();
}

// Per-content rows for the evidence table: latest perf + revenue total from history.
function collectPerfRows() {
  const rows = [];
  contentLibrary.forEach(function(item) {
    if (!item.perf) return;
    const hist = itemPerfHistory(item);
    const revenueTotal = hist.reduce(function(s, h) { return s + (h.commission_thb || 0); }, 0);
    rows.push({ name: item.name, libraryId: item.libraryId, version: item.lineage ? item.lineage.version : null, perf: item.perf, revenueTotal: revenueTotal });
  });
  candidatePool.forEach(function(c) {
    if (!c.perf) return;
    const libId = 'lib-' + c.id;
    const hasLib = contentLibrary.some(function(it) {
      const sameItem = it.libraryId === libId || String(it.id) === String(c.id);
      return sameItem && (it.perfHistory || it.perf);
    });
    if (!hasLib) {
      const hist = itemPerfHistory(c);
      const revenueTotal = hist.reduce(function(s, h) { return s + (h.commission_thb || 0); }, 0);
      rows.push({ name: c.name, libraryId: null, version: null, perf: c.perf, revenueTotal: revenueTotal });
    }
  });
  return rows;
}

function drawTrendChart() {
  var canvas = dom.trendCanvas;
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var width = canvas.width;
  var height = canvas.height;
  var points = candidatePool.slice(0, 8);
  ctx.clearRect(0, 0, width, height);

  if (!points.length) return;

  var maxClicks = Math.max.apply(null, points.map(function(c) { return c.clicks || 0; })) || 1;
  var maxSales = Math.max.apply(null, points.map(function(c) { return c.estimatedSale || 0; })) || 1;
  var slot = width / points.length;
  var barWidth = Math.max(6, slot * 0.24);
  var base = height - 18;

  points.forEach(function(c, i) {
    var x = i * slot + slot / 2;
    var clicksH = ((c.clicks || 0) / maxClicks) * (base - 12);
    var salesH = ((c.estimatedSale || 0) / maxSales) * (base - 12);

    ctx.fillStyle = '#414a7d';
    ctx.fillRect(x - barWidth - 2, base - clicksH, barWidth, clicksH);

    ctx.fillStyle = '#1e5f49';
    ctx.fillRect(x + 2, base - salesH, barWidth, salesH);

    ctx.fillStyle = '#6b7a71';
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(c.platform || '', x, height - 4);
  });
}

// ----- Report (Easy step 6): 4 windows + drill down channel → content → day -----
//
// Every number here comes from imported result evidence (perfHistory on library
// items / pool candidates). Nothing is estimated. Rows recorded through the
// server (/api/mvp/results) are shown in a separate, clearly labelled block so
// the two sources can never silently add up to a made-up total.

const REPORT_WINDOWS = [
  { key: 'day', label: 'วันนี้', days: 1 },
  { key: '7d', label: '7 วัน', days: 7 },
  { key: '30d', label: '30 วัน', days: 30 },
  { key: 'all', label: 'สะสม', days: null },
];

let reportWindowKey = '7d';
let reportDrill = { level: 'channel', channel: null, contentId: null };

function reportDayString(date) {
  const pad = function(n) { return (n < 10 ? '0' : '') + n; };
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

function reportCutoff(key) {
  const win = REPORT_WINDOWS.filter(function(w) { return w.key === key; })[0];
  if (!win || win.days === null) return null; // สะสม = ไม่ตัดช่วง
  const d = new Date();
  d.setDate(d.getDate() - (win.days - 1));
  return reportDayString(d);
}

function reportWindowLabel() {
  const win = REPORT_WINDOWS.filter(function(w) { return w.key === reportWindowKey; })[0];
  return win ? win.label : reportWindowKey;
}

/** One flat row per (content, date, channel, sub_id) — the unit the results CSV carries. */
function reportRows() {
  const rows = [];
  const seen = {};
  const pushFrom = function(holder) {
    const id = String(holder.id);
    if (seen[id]) return; // the same candidate may also exist as a library entry
    seen[id] = true;
    const name = holder.name || ('#' + id);
    itemPerfHistory(holder).forEach(function(h) {
      const date = String(h.date || (h.imported_at || '').slice(0, 10)).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      rows.push({
        date: date,
        channel: h.platform || holder.platform || 'ไม่ระบุช่องทาง',
        subId: h.sub_id || '',
        contentId: id,
        content: name,
        views: Number(h.views) || 0,
        clicks: Number(h.clicks) || 0,
        orders: Number(h.orders) || 0,
        commission: Number(h.commission_thb) || 0,
        invalid: Number(h.invalid_clicks) || 0,
        newCustomers: Number(h.new_customers) || 0,
      });
    });
  };
  contentLibrary.forEach(pushFrom);
  candidatePool.forEach(pushFrom);
  return rows.sort(function(a, b) { return a.date.localeCompare(b.date); });
}

function hasReportData() {
  return reportRows().length > 0;
}

function reportRowsInWindow() {
  const cutoff = reportCutoff(reportWindowKey);
  const rows = reportRows();
  return cutoff ? rows.filter(function(r) { return r.date >= cutoff; }) : rows;
}

function reportMoney(value) {
  return '฿' + Number(value || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
}

function reportNum(value) {
  return Number(value || 0).toLocaleString('th-TH');
}

function reportConv(orders, clicks) {
  return clicks ? ((orders / clicks) * 100).toFixed(1) + '%' : '—';
}

function drawReportChart() {
  const canvas = document.getElementById('report-canvas');
  const note = document.getElementById('report-chart-note');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const byDate = {};
  reportRowsInWindow().forEach(function(r) { byDate[r.date] = (byDate[r.date] || 0) + r.commission; });
  const series = Object.keys(byDate).sort().map(function(d) { return { date: d, commission: byDate[d] }; });

  if (note) {
    const total = series.reduce(function(s, p) { return s + p.commission; }, 0);
    note.textContent = series.length
      ? series.length + ' วันที่มีข้อมูลในช่วง “' + reportWindowLabel() + '” · รายได้รวม ' + reportMoney(total)
      : 'ยังไม่มีข้อมูลในช่วง “' + reportWindowLabel() + '”';
  }
  if (!series.length) return;

  const padL = 64, padR = 16, padT = 14, padB = 34;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const max = Math.max.apply(null, series.map(function(p) { return p.commission; })) || 1;

  ctx.strokeStyle = 'rgba(139,124,255,0.18)';
  ctx.fillStyle = '#8f86c8';
  ctx.font = '10px ui-monospace, monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = padT + plotH * (i / 4);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillText('฿' + Math.round(max * (1 - i / 4)).toLocaleString('th-TH'), padL - 8, y + 3);
  }

  const xFor = function(i) { return series.length === 1 ? padL + plotW / 2 : padL + (plotW * i) / (series.length - 1); };
  const yFor = function(v) { return padT + plotH - (plotH * v) / max; };
  const accent = (getComputedStyle(document.body).getPropertyValue('--studio-orange') || '').trim() || '#ff6b1a';

  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  series.forEach(function(p, i) {
    const x = xFor(i), y = yFor(p.commission);
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = accent;
  series.forEach(function(p, i) {
    ctx.beginPath(); ctx.arc(xFor(i), yFor(p.commission), 3, 0, Math.PI * 2); ctx.fill();
  });

  ctx.fillStyle = '#8f86c8';
  ctx.textAlign = 'center';
  const step = Math.ceil(series.length / 7);
  series.forEach(function(p, i) { if (i % step) return; ctx.fillText(p.date.slice(5), xFor(i), h - 12); });
}

function renderReportKpis(rows) {
  const host = document.getElementById('report-kpis');
  if (!host) return;
  const total = rows.reduce(function(acc, r) {
    acc.clicks += r.clicks; acc.orders += r.orders; acc.commission += r.commission;
    acc.views += r.views; acc.invalid += r.invalid;
    acc.contents[r.contentId] = true; acc.channels[r.channel] = true;
    return acc;
  }, { clicks: 0, orders: 0, commission: 0, views: 0, invalid: 0, contents: {}, channels: {} });
  const contentCount = Object.keys(total.contents).length;
  const channelCount = Object.keys(total.channels).length;
  const card = function(title, value, sub) {
    return '<div class="dashboard-card"><div class="card-head"><h3>' + title + '</h3></div>' +
      '<div class="card-value">' + value + '</div>' +
      '<div class="card-change">' + sub + '</div></div>';
  };
  host.innerHTML = [
    card('รายได้ (จริง)', reportMoney(total.commission), 'ช่วง ' + reportWindowLabel()),
    card('ออเดอร์', reportNum(total.orders), 'จาก CSV ผลลัพธ์'),
    card('คลิก', reportNum(total.clicks), 'Conversion ' + reportConv(total.orders, total.clicks)),
    card('เฉลี่ย / คอนเทนต์', reportMoney(contentCount ? total.commission / contentCount : 0), contentCount + ' คอนเทนต์'),
    card('เฉลี่ย / ช่องทาง', reportMoney(channelCount ? total.commission / channelCount : 0), channelCount + ' ช่องทาง'),
    card('Views', reportNum(total.views), 'รวมทุกแถวในช่วงนี้'),
    card('คลิกที่ผิด', reportNum(total.invalid), 'จากรายงานคลิกที่ผิด'),
  ].join('');
}

function renderReportCrumbs(rows) {
  const host = document.getElementById('report-crumbs');
  if (!host) return;
  const parts = [];
  if (reportDrill.level === 'channel') {
    parts.push('<span class="crumb-current">ทุกช่องทาง</span>');
  } else if (reportDrill.level === 'content') {
    parts.push('<button type="button" data-report-level="channel">ทุกช่องทาง</button>');
    parts.push('<span class="crumb-sep">›</span><span class="crumb-current">' + escapeHtml(reportDrill.channel) + '</span>');
  } else {
    const content = rows.filter(function(r) { return r.contentId === reportDrill.contentId; })[0];
    parts.push('<button type="button" data-report-level="channel">ทุกช่องทาง</button>');
    parts.push('<span class="crumb-sep">›</span><button type="button" data-report-level="content" data-channel="' + escapeHtml(reportDrill.channel) + '">' + escapeHtml(reportDrill.channel) + '</button>');
    parts.push('<span class="crumb-sep">›</span><span class="crumb-current">' + escapeHtml(content ? content.content : reportDrill.contentId) + '</span>');
  }
  parts.push('<span class="muted small" style="margin-left:auto">คลิกแถวเพื่อเจาะลึก</span>');
  host.innerHTML = parts.join('');
}

function renderReportTable(rows) {
  const thead = document.getElementById('report-thead');
  const tbody = document.getElementById('report-tbody');
  if (!thead || !tbody) return;
  const head = function(cells) {
    thead.innerHTML = '<tr>' + cells.map(function(c) { return '<th>' + c + '</th>'; }).join('') + '</tr>';
  };
  const num = function(html) { return '<td class="perf-num">' + html + '</td>'; };

  if (reportDrill.level === 'channel') {
    head(['ช่องทาง', 'คอนเทนต์', 'Views', 'คลิก', 'ออเดอร์', 'Conv', 'ค่าคอม']);
    const groups = {};
    rows.forEach(function(r) {
      const g = groups[r.channel] || (groups[r.channel] = { views: 0, clicks: 0, orders: 0, commission: 0, contents: {} });
      g.views += r.views; g.clicks += r.clicks; g.orders += r.orders; g.commission += r.commission;
      g.contents[r.contentId] = true;
    });
    const list = Object.keys(groups).sort(function(a, b) { return groups[b].commission - groups[a].commission; });
    tbody.innerHTML = list.length ? list.map(function(ch) {
      const g = groups[ch];
      return '<tr class="is-clickable" data-drill="channel" data-channel="' + escapeHtml(ch) + '">' +
        '<td>' + escapeHtml(ch) + '</td>' +
        num(Object.keys(g.contents).length) +
        num(reportNum(g.views)) + num(reportNum(g.clicks)) + num(reportNum(g.orders)) +
        num(reportConv(g.orders, g.clicks)) + num(reportMoney(g.commission)) + '</tr>';
    }).join('') : '<tr><td colspan="7" class="muted">ไม่มีข้อมูลในช่วงนี้</td></tr>';
    return;
  }

  const scoped = rows.filter(function(r) { return r.channel === reportDrill.channel; });

  if (reportDrill.level === 'content') {
    head(['คอนเทนต์', 'Sub_id', 'Views', 'คลิก', 'ออเดอร์', 'Conv', 'ค่าคอม', 'วันล่าสุด']);
    const groups = {};
    scoped.forEach(function(r) {
      const g = groups[r.contentId] || (groups[r.contentId] = { name: r.content, views: 0, clicks: 0, orders: 0, commission: 0, subs: {}, last: '' });
      g.views += r.views; g.clicks += r.clicks; g.orders += r.orders; g.commission += r.commission;
      if (r.subId) g.subs[r.subId] = true;
      if (r.date > g.last) g.last = r.date;
    });
    const list = Object.keys(groups).sort(function(a, b) { return groups[b].commission - groups[a].commission; });
    tbody.innerHTML = list.length ? list.map(function(id) {
      const g = groups[id];
      return '<tr class="is-clickable" data-drill="content" data-content-id="' + escapeHtml(id) + '">' +
        '<td>' + escapeHtml(g.name) + '</td>' +
        '<td>' + escapeHtml(Object.keys(g.subs).join(', ') || '—') + '</td>' +
        num(reportNum(g.views)) + num(reportNum(g.clicks)) + num(reportNum(g.orders)) +
        num(reportConv(g.orders, g.clicks)) + num(reportMoney(g.commission)) + num(g.last || '—') + '</tr>';
    }).join('') : '<tr><td colspan="8" class="muted">ช่องทางนี้ยังไม่มีคอนเทนต์ที่มีผลในช่วงนี้</td></tr>';
    return;
  }

  head(['วันที่', 'Sub_id', 'Views', 'คลิก', 'ออเดอร์', 'Conv', 'ค่าคอม']);
  const days = scoped.filter(function(r) { return r.contentId === reportDrill.contentId; })
    .sort(function(a, b) { return b.date.localeCompare(a.date); });
  tbody.innerHTML = days.length ? days.map(function(r) {
    return '<tr><td>' + escapeHtml(r.date) + '</td>' +
      '<td>' + escapeHtml(r.subId || '—') + '</td>' +
      num(reportNum(r.views)) + num(reportNum(r.clicks)) + num(reportNum(r.orders)) +
      num(reportConv(r.orders, r.clicks)) + num(reportMoney(r.commission)) + '</tr>';
  }).join('') : '<tr><td colspan="7" class="muted">ไม่มีข้อมูลรายวันสำหรับคอนเทนต์นี้</td></tr>';
}

function renderReportServerBlock() {
  const block = document.getElementById('report-server-block');
  const host = document.getElementById('report-server-body');
  if (!block || !host) return;
  fetch('/api/mvp/analytics', { headers: { Accept: 'application/json' } })
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(data) {
      const rows = data && Array.isArray(data.by_content)
        ? data.by_content.filter(function(r) { return Number(r.results_count) > 0; })
        : [];
      if (!rows.length) { block.classList.add('hidden'); return; } // ไม่มีข้อมูล = ซ่อน ไม่โชว์กล่องว่าง
      block.classList.remove('hidden');
      host.innerHTML = '<table class="perf-table"><thead><tr><th>คอนเทนต์</th><th>ช่องทาง</th><th>คลิก</th><th>ออเดอร์</th><th>ค่าคอม</th><th>บันทึกล่าสุด</th></tr></thead><tbody>' +
        rows.map(function(r) {
          return '<tr><td>' + escapeHtml(r.title || r.content_id) + '</td>' +
            '<td>' + escapeHtml(r.platform || r.channel || '—') + '</td>' +
            '<td class="perf-num">' + reportNum(r.clicks) + '</td>' +
            '<td class="perf-num">' + reportNum(r.orders) + '</td>' +
            '<td class="perf-num">' + reportMoney(r.commission_thb) + '</td>' +
            '<td class="perf-num">' + escapeHtml(r.last_recorded_at ? String(r.last_recorded_at).slice(0, 10) : '—') + '</td></tr>';
        }).join('') + '</tbody></table>' +
        '<p class="muted small">' + escapeHtml((data.source && data.source.note) || '') + ' — แสดงแยกจากตารางหลักเพื่อไม่ให้ยอดซ้ำกัน</p>';
    })
    .catch(function() { block.classList.add('hidden'); });
}

function renderReport() {
  const all = reportRows();
  const empty = document.getElementById('report-empty');
  const body = document.getElementById('report-body');
  const pills = document.getElementById('report-periods');
  const note = document.getElementById('report-window-note');

  if (pills) {
    pills.innerHTML = REPORT_WINDOWS.map(function(w) {
      return '<button type="button" class="chip-btn' + (w.key === reportWindowKey ? ' is-active' : '') +
        '" data-report-window="' + w.key + '" aria-pressed="' + (w.key === reportWindowKey ? 'true' : 'false') + '">' +
        w.label + '</button>';
    }).join('');
  }

  if (!all.length) {
    if (empty) empty.classList.remove('hidden');
    if (body) body.classList.add('hidden');
    if (note) note.textContent = 'ยังไม่มีข้อมูลผลจริง — หน้านี้จะซ่อนขั้นรายงานไว้งนกว่าจะมีข้อมูล';
    return;
  }

  if (empty) empty.classList.add('hidden');
  if (body) body.classList.remove('hidden');

  const rows = reportRowsInWindow();
  // A drill level that has no rows in this window falls back to the channel list.
  if (reportDrill.level !== 'channel' && !rows.some(function(r) { return r.channel === reportDrill.channel; })) {
    reportDrill = { level: 'channel', channel: null, contentId: null };
  }
  if (reportDrill.level === 'day' && !rows.some(function(r) { return r.contentId === reportDrill.contentId; })) {
    reportDrill = { level: 'content', channel: reportDrill.channel, contentId: null };
  }

  if (note) {
    note.textContent = 'ช่วง “' + reportWindowLabel() + '” · ' + rows.length + ' แถวผลลัพธ์จาก ' +
      Object.keys(rows.reduce(function(a, r) { a[r.contentId] = true; return a; }, {})).length + ' คอนเทนต์ · แหล่งข้อมูล: ไฟล์ CSV ผลลัพธ์ที่นำเข้า (perfHistory)';
  }

  renderReportKpis(rows);
  drawReportChart();
  renderReportCrumbs(rows);
  renderReportTable(rows);
  renderReportServerBlock();
}

function bindReport() {
  const stage = document.getElementById('report-stage');
  if (!stage || stage.dataset.bound === '1') return;
  stage.dataset.bound = '1';
  stage.addEventListener('click', function(e) {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    const pill = target.closest('[data-report-window]');
    if (pill) {
      reportWindowKey = pill.dataset.reportWindow;
      reportDrill = { level: 'channel', channel: null, contentId: null };
      renderReport();
      return;
    }
    const crumb = target.closest('[data-report-level]');
    if (crumb) {
      reportDrill = {
        level: crumb.dataset.reportLevel,
        channel: crumb.dataset.channel || null,
        contentId: null,
      };
      renderReport();
      return;
    }
    const row = target.closest('[data-drill]');
    if (row) {
      if (row.dataset.drill === 'channel') {
        reportDrill = { level: 'content', channel: row.dataset.channel, contentId: null };
        renderReport();
      } else if (row.dataset.drill === 'content') {
        reportDrill = { level: 'day', channel: reportDrill.channel, contentId: row.dataset.contentId };
        renderReport();
      }
    }
  });
  const importBtn = document.getElementById('report-import');
  const fileInput = document.getElementById('results-csv-file');
  if (importBtn && fileInput) {
    importBtn.addEventListener('click', function() { fileInput.click(); });
  }
}

function refreshDashboard() {
  renderDashboard();
  showToast('รีเฟรช Dashboard จากหลักฐานนำเข้าเรียบร้อย', 'info');
}

function importCSVHandler() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,text/csv';

  input.addEventListener('change', function() {
    var file = input.files && input.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function() {
      var rows = String(reader.result).split(/\r?\n/).filter(function(row) { return row.trim() !== ''; });
      var totalSales = 0;
      var totalClicks = 0;
      var totalCommission = 0;
      var parsed = 0;

      rows.forEach(function(row, index) {
        var nums = row.split(',').map(function(cell) {
          return parseFloat(String(cell).replace(/[^0-9.-]/g, ''));
        }).filter(function(n) { return !isNaN(n); });

        if (index === 0 && nums.length < 3) return; // header row
        if (nums.length >= 3) {
          totalSales += nums[0];
          totalClicks += nums[1];
          totalCommission += nums[2];
          parsed++;
        }
      });

      if (!parsed) {
        showToast('ไม่พบข้อมูลตัวเลขในไฟล์ CSV', 'warning');
        return;
      }

      dashboardData.totalSales = totalSales;
      dashboardData.totalClicks = totalClicks;
      dashboardData.totalCommission = totalCommission;
      renderDashboard();
      showToast('นำเข้า CSV ' + parsed + ' แถวเรียบร้อย', 'success');
    };

    reader.readAsText(file);
  });

  input.click();
}

// ----- Stage Management -----

const STAGE_SECTIONS = [
  'detail-quickstart',
  'detail-library',
  'detail-schedule',

  'actor-studio',
  'content-library',
  'library-sync',
  'dashboard-area',
  'report-stage',
  'pool-panel',
  'candidate-hero',
  'affiliate-panel',
  'detail-content-tabs',
  'plan-stage',
  'storyboard-stage',
  'production-stage'
];

// some ids appear more than once in the markup, so toggle every match
function eachSection(id, fn) {
  document.querySelectorAll('[id="' + id + '"]').forEach(fn);
}

function hideAllSections() {
  STAGE_SECTIONS.forEach(function(id) {
    eachSection(id, function(el) { el.classList.add('hidden'); });
  });
  document.querySelectorAll('.mvp-source-library').forEach(function(el) {
    el.classList.add('hidden');
  });
}

function showSections(ids, showSources) {
  ids.forEach(function(id) {
    eachSection(id, function(el) { el.classList.remove('hidden'); });
  });
  document.querySelectorAll('.mvp-source-library').forEach(function(el) {
    el.classList.toggle('hidden', !showSources);
  });
}

const stageMap = {
  research: {
    name: 'Research',
    activate: function() {
      hideAllSections();
      // quick start + market research panel (holds the add-source buttons) + Source Library
      showSections(['pool-panel', 'detail-quickstart', 'candidate-hero', 'affiliate-panel', 'detail-content-tabs'], true);
      setSelectionPanelsVisible(Boolean(currentCandidate()));
      renderSourceLibrary();
      showToast('เข้าสู่โหมด Research — สร้าง Candidate Pool ใหม่', 'info');
    }
  },
  plan: {
    name: 'Plan',
    activate: function() {
      hideAllSections();
      showSections(['plan-stage'], false);
      renderPlanStage();
      showToast('เข้าสู่โหมด Plan — กำหนดแผนและเลือกนักแสดง', 'info');
    }
  },
  storyboard: {
    name: 'Storyboard',
    activate: function() {
      hideAllSections();
      showSections(['storyboard-stage'], false);
      renderStoryboardStage();
      showToast('เข้าสู่โหมด Storyboard — breakdown จาก Plan', 'info');
    }
  },
  production: {
    name: 'Production',
    activate: function() {
      hideAllSections();
      showSections(['production-stage'], false);
      renderProductionStage();
      showToast('เข้าสู่โหมด Production — ต่อจาก Storyboard', 'info');
    }
  },
  finalize: {
    name: 'Finalize',
    activate: function() {
      hideAllSections();
      showSections(['detail-library'], false);
      seedContentLibraryFromPool();
      renderContentLibrary();
      showToast('เข้าสู่โหมด Finalize — ตรวจคุณภาพและอนุมัติงานก่อนเผยแพร่', 'info');
    }
  },
  dashboard: {
    name: 'Dashboard',
    activate: function() {
      hideAllSections();
      showSections(['dashboard-area'], false);
      refreshDashboard();
      showToast('เข้าสู่โหมด Dashboard - วิเคราะห์ผลการทำงาน', 'info');
    }
  },
  report: {
    name: 'Report',
    activate: function() {
      hideAllSections();
      showSections(['report-stage'], false);
      renderReport();
      showToast('เข้าสู่โหมด Report — รายงาน 4 ระยะ + เจาะลึก ช่องทาง → คอนเทนต์ → วัน', 'info');
    }
  },
  schedule: {
    name: 'Schedule',
    activate: function() {
      hideAllSections();
      showSections(['detail-schedule', 'detail-library'], false);
      seedContentLibraryFromPool();
      renderContentLibrary();
      renderPublishQueue();
      showToast('เข้าสู่โหมด Schedule - แผนการโพสต์และลำดับ', 'info');
    }
  }
};

function switchStage(stageKey) {
  markActiveNav(stageKey);
  document.body.dataset.stage = stageKey;
  if (stageMap[stageKey]) stageMap[stageKey].activate();
  updateStudioStage(stageKey);
}

function initStage() {
  // default to the Research stage so the Source Library is visible on load
  switchStage('research');
}

function attachLibraryHandlers() {
  // Approve row (ACTIVE → APPROVE, freeze the reviewed file)
  document.querySelectorAll('.approve-row').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var index = parseInt(this.dataset.index, 10);
      if (index >= 0 && index < contentLibrary.length) {
        approveLineage(contentLibrary[index]);
        renderContentLibrary();
      }
    });
  });

  // Reject row
  document.querySelectorAll('.reject-row').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var index = parseInt(this.dataset.index, 10);
      if (index >= 0 && index < contentLibrary.length) {
        contentLibrary[index].status = 'REJECT';
        renderContentLibrary();
        showToast('ปฏิเสธรายการสำเร็จ', 'error');
      }
    });
  });

  // Set as Active Lineage (PENDING → ACTIVE) / Send to Publish Queue (APPROVE → EXPORTED)
  document.querySelectorAll('.set-active-row').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var index = parseInt(this.dataset.index, 10);
      if (index >= 0 && index < contentLibrary.length) {
        var item = contentLibrary[index];
        if (item.status === 'PENDING') {
          item.status = 'ACTIVE';
          if (!item.lineage) item.lineage = { version: 0, history: [] };
          item.lineage.status = 'ACTIVE';
          pushLineageEvent(item, 'ตั้งเป็น Active Lineage — ตรวจละเอียดผ่านจอ QC ได้จากแถวนี้');
          savePoolState();
          renderContentLibrary();
          showToast('ตั้งเป็น Active Lineage แล้ว — กด "ตรวจ Full Screen" เพื่อตรวจละเอียด', 'success');
          return;
        }
        if (item.status !== 'APPROVE') {
          showToast('รายการต้องอนุมัติก่อนจึงจะส่งเข้า Publish Queue ได้', 'warning');
          return;
        }
        openPublishConfirm(index);
      }
    });
  });

  // Request changes (ACTIVE → PENDING with note)
  document.querySelectorAll('.request-changes-row').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var index = parseInt(this.dataset.index, 10);
      if (index >= 0 && index < contentLibrary.length) {
        var item = contentLibrary[index];
        var note = prompt('โน้ตสั่งแก้ไข (บอกจุดที่ต้องแก้):', (item.lineage && item.lineage.editNote) || '');
        if (note === null) return;
        requestLineageChanges(item, note || '');
        renderContentLibrary();
      }
    });
  });

  // Row click selects the lineage (buttons and checkboxes keep their own behaviour)
  document.querySelectorAll('.library-row').forEach(function(row) {
    row.addEventListener('click', function(event) {
      if (event.target.closest('button, input, select, a, label')) return;
      var index = parseInt(row.dataset.index, 10);
      if (index >= 0 && index < contentLibrary.length) selectLibraryRow(index);
    });
  });

  // QC Full Screen for the selected row
  var qcToolbar = document.getElementById('library-qc');
  if (qcToolbar && qcToolbar.dataset.bound !== '1') {
    qcToolbar.dataset.bound = '1';
    qcToolbar.addEventListener('click', function() {
      if (librarySelectedIndex < 0 || !contentLibrary[librarySelectedIndex]) {
        showToast('เลือกแถวในตารางก่อน แล้วกด “ตรวจ Full Screen”', 'warning');
        return;
      }
      openQcOverlay(librarySelectedIndex);
    });
  }

  // Row checkbox toggle
  document.querySelectorAll('.row-checkbox').forEach(function(cb) {
    cb.addEventListener('change', function(e) {
      var index = parseInt(cb.closest('tr').dataset.index, 10);
      if (index >= 0 && index < contentLibrary.length) {
        contentLibrary[index].selected = cb.checked;
        updateLibraryCount();
        renderPublishConfirm();
      }
    });
  });
}

// ----- Daily Loop: lineage + Full-Screen Quality Check + Mini Loop -----

/**
 * Resolves the one Content Library entry that represents `candidate`.
 *
 * The pool and the library are two views of the same product, but a library
 * entry can carry an id this code did not create: moveCandidateToLibrary()
 * pushes `lib-<timestamp>-<random>`. Match with a fixed precedence — canonical
 * id, then candidate id, then affiliate link — so a render and the UI never end
 * up pointing at two different entries. Only a candidate with no match at all
 * gets a new entry.
 */
function ensureLibraryItemForCandidate(candidate) {
  if (!candidate) return null;
  const libId = 'lib-' + candidate.id;
  const candidateId = String(candidate.id);
  const link = String(candidate.affiliateLink || '').trim();
  const existing =
    contentLibrary.find(function(it) { return it.libraryId === libId; }) ||
    contentLibrary.find(function(it) { return String(it.id) === candidateId; }) ||
    (link ? contentLibrary.find(function(it) { return String(it.affiliateLink || '').trim() === link; }) : null);
  if (existing) return existing;

  const created = Object.assign({}, candidate, {
    libraryId: libId,
    status: 'PENDING',
    qualityScore: candidate.quality || 'medium',
  });
  contentLibrary.push(created);
  return created;
}

function pushLineageEvent(item, event, extra) {
  if (!item.lineage) item.lineage = { version: 0, history: [] };
  if (!Array.isArray(item.lineage.history)) item.lineage.history = [];
  item.lineage.history.push(Object.assign({ at: new Date().toISOString(), version: item.lineage.version || 0, event: event }, extra || {}));
}

function attachRenderToLineage(candidate, data) {
  var item = ensureLibraryItemForCandidate(candidate);
  if (!item) return null;
  if (!item.lineage) item.lineage = { version: 0, history: [] };
  var wasApproved = item.lineage.status === 'APPROVED';
  item.lineage.version = (item.lineage.version || 0) + 1;
  item.lineage.fileUrl = data.url;
  item.lineage.sha256 = data.sha256 || null;
  item.lineage.bytes = data.bytes || 0;
  item.lineage.duration_s = data.duration_s || null;
  item.lineage.width = data.width || null;
  item.lineage.height = data.height || null;
  item.lineage.renderedAt = new Date().toISOString();
  item.lineage.narrationOk = Boolean(data.narration && data.narration.ok);
  item.lineage.narrationInfo = data.narration
    ? (data.narration.ok ? ((data.narration.voice || '') + ' (' + data.narration.lines + '/' + data.narration.total + ' บรรทัด)') : ('ไม่มีเสียง — ' + String(data.narration.error || '').slice(0, 40)))
    : null;
  item.lineage.status = 'RENDERED';
  if (wasApproved || item.status === 'APPROVE') {
    // A new version invalidates the frozen approval — honest reset.
    item.status = 'PENDING';
    pushLineageEvent(item, 'เรนเดอร์ v' + item.lineage.version + ' หลังอนุมัติ — อนุมัติเดิมถูกยกเลิก ต้องตรวจซ้ำ');
  } else {
    pushLineageEvent(item, 'เรนเดอร์ v' + item.lineage.version, { sha256: item.lineage.sha256 });
  }
  savePoolState();
  return item;
}

function approveLineage(item) {
  if (!item) return;
  if (!item.lineage || !item.lineage.fileUrl) {
    item.status = 'APPROVE';
    savePoolState();
    showToast('อนุมัติรายการสำเร็จ (ยังไม่มีไฟล์เรนเดอร์ — เผยแพร่ต้องมีไฟล์อนุมัติก่อน)', 'warning');
    return;
  }
  item.status = 'APPROVE';
  item.lineage.status = 'APPROVED';
  item.lineage.approvedAt = new Date().toISOString();
  item.lineage.approvedSha256 = item.lineage.sha256 || null;
  pushLineageEvent(item, 'อนุมัติ — freeze ไฟล์เวอร์ชันนี้สำหรับเผยแพร่', { sha256: item.lineage.approvedSha256 });
  savePoolState();
  showToast('อนุมัติแล้ว — เผยแพร่ด้วยไฟล์ v' + (item.lineage.version || 1) + ' เท่านั้น', 'success');
}

function requestLineageChanges(item, note) {
  if (!item) return;
  item.status = 'PENDING';
  if (!item.lineage) item.lineage = { version: 0, history: [] };
  item.lineage.status = 'PENDING';
  item.lineage.editNote = note;
  item.lineage.requestedAt = new Date().toISOString();
  pushLineageEvent(item, 'สั่งแก้ไข', { note: note });
  savePoolState();
  showToast('ส่งกลับไปแก้ไขแล้ว — เรนเดอร์ใหม่จะเป็นเวอร์ชันถัดไป', 'info');
}

let qcCurrentIndex = -1;
/* The Content Library row the operator is working on: a click on the row is
   what makes it the active lineage, so QC and approve act on this index. */
let librarySelectedIndex = -1;

function openQcOverlay(index) {
  var item = contentLibrary[index];
  if (!item || !item.lineage || !item.lineage.fileUrl) {
    showToast('รายการนี้ยังไม่มีไฟล์เรนเดอร์ — กด "สร้างคลิปพรีวิว" ในแผง Content Draft ก่อน', 'warning');
    return;
  }
  qcCurrentIndex = index;
  var overlay = document.getElementById('qc-overlay');
  var video = document.getElementById('qc-video');
  if (!overlay || !video) return;
  video.src = item.lineage.fileUrl;
  var statusLabel = { PENDING: 'ร่าง', ACTIVE: 'Active Lineage', APPROVE: 'อนุมัติแล้ว (freeze)', REJECT: 'ปฏิเสธ', EXPORTED: 'เผยแพร่แล้ว' }[item.status] || item.status;
  var sub = document.getElementById('qc-sub');
  if (sub) sub.textContent = statusLabel + ' · v' + (item.lineage.version || 1) + ' — สิ่งที่เห็นคือสิ่งที่จะเผยแพร่ (ไฟล์เดียวกันทุกไบต์)';
  renderQcMeta(item);
  renderQcHistory(item);
  var approveBtn = document.getElementById('qc-approve');
  if (approveBtn) approveBtn.disabled = item.status === 'APPROVE' || item.status === 'EXPORTED';
  var note = document.getElementById('qc-note-input');
  if (note) note.value = item.lineage.editNote || '';
  overlay.classList.remove('hidden');
  document.body.classList.add('qc-open');
}

function renderQcMeta(item) {
  var host = document.getElementById('qc-meta');
  if (!host) return;
  var ln = item.lineage || {};
  var rows = [
    ['รหัสโปรเจกต์', item.libraryId || '--'],
    ['สถานะ', { PENDING: 'ร่าง', ACTIVE: 'Active Lineage', APPROVE: 'อนุมัติแล้ว', REJECT: 'ปฏิเสธ', EXPORTED: 'เผยแพร่แล้ว' }[item.status] || item.status],
    ['เวอร์ชัน', 'v' + (ln.version || 1) + (ln.approvedSha256 ? ' (อนุมัติ freeze)' : '')],
    ['ไฟล์', Math.round((ln.bytes || 0) / 1024) + ' KB · ' + (ln.duration_s || '?') + 's · ' + (ln.width || '?') + '×' + (ln.height || '?')],
    ['sha256 (เรนเดอร์)', ln.sha256 ? String(ln.sha256).slice(0, 16) + '…' : '—'],
    ['sha256 (อนุมัติ)', ln.approvedSha256 ? String(ln.approvedSha256).slice(0, 16) + '…' : 'ยังไม่ freeze'],
    ['เสียงพากย์', ln.narrationOk ? (ln.narrationInfo || 'มี') : (ln.narrationInfo || 'ไม่มี')],
    ['โน้ตสั่งแก้ล่าสุด', ln.editNote || '—'],
  ];
  host.innerHTML = rows.map(function(r) {
    return '<div class="qc-meta-row"><span>' + escapeHtml(r[0]) + '</span><b>' + escapeHtml(String(r[1])) + '</b></div>';
  }).join('');
}

function renderQcHistory(item) {
  var host = document.getElementById('qc-history');
  if (!host) return;
  var history = (item.lineage && item.lineage.history) || [];
  if (!history.length) {
    host.innerHTML = '<p class="muted small">ยังไม่มีเหตุการณ์</p>';
    return;
  }
  host.innerHTML = history.slice().reverse().map(function(h) {
    var when = h.at ? new Date(h.at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    return '<div class="qc-history-row"><span class="qc-history-when">' + escapeHtml(when) + '</span>' +
      '<span>' + escapeHtml(h.event || '') + (h.note ? ' — “' + escapeHtml(h.note) + '”' : '') + '</span></div>';
  }).join('');
}

function closeQcOverlay() {
  var overlay = document.getElementById('qc-overlay');
  var video = document.getElementById('qc-video');
  if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
  if (overlay) overlay.classList.add('hidden');
  document.body.classList.remove('qc-open');
  qcCurrentIndex = -1;
}

function qcApprove() {
  var item = contentLibrary[qcCurrentIndex];
  if (!item) return;
  approveLineage(item);
  renderContentLibrary();
  openQcOverlay(qcCurrentIndex);
}

function qcRequestChanges() {
  var item = contentLibrary[qcCurrentIndex];
  if (!item) return;
  var note = (document.getElementById('qc-note-input') || {}).value || '';
  if (!note.trim()) {
    showToast('ใส่โน้ตบอกจุดที่ต้องแก้ก่อนสั่งแก้ไข', 'warning');
    return;
  }
  requestLineageChanges(item, note.trim());
  renderContentLibrary();
  closeQcOverlay();
}

function qcMiniLoop(stageKey) {
  var item = contentLibrary[qcCurrentIndex];
  if (!item) return;
  var candidate = candidatePool.find(function(c) { return String(c.id) === String(item.id); });
  if (!candidate) {
    showToast('Mini Loop ต้องมีต้นฉบับสินค้าใน Pool — ต้นฉบับถูกถอนออกแล้ว', 'warning');
    return;
  }
  if (currentMode() === 'easy') setMode('advance');
  selectedCandidateId = candidate.id;
  closeQcOverlay();
  switchStage(stageKey);
  showToast('แก้ละเอียดขั้น ' + stageKey.toUpperCase() + ' (Advance) — เรนเดอร์ใหม่แล้วกลับมากด "ตรวจ Full Screen" ใน Content Library', 'info');
}

function bindQcOverlay() {
  var overlay = document.getElementById('qc-overlay');
  if (!overlay || overlay.dataset.bound === '1') return;
  overlay.dataset.bound = '1';
  var closeBtn = document.getElementById('qc-close');
  if (closeBtn) closeBtn.addEventListener('click', closeQcOverlay);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeQcOverlay(); });
  var approveBtn = document.getElementById('qc-approve');
  if (approveBtn) approveBtn.addEventListener('click', qcApprove);
  var changeBtn = document.getElementById('qc-request-changes');
  if (changeBtn) changeBtn.addEventListener('click', qcRequestChanges);
  var planBtn = document.getElementById('qc-mini-plan');
  if (planBtn) planBtn.addEventListener('click', function() { qcMiniLoop('plan'); });
  var storyboardBtn = document.getElementById('qc-mini-storyboard');
  if (storyboardBtn) storyboardBtn.addEventListener('click', function() { qcMiniLoop('storyboard'); });
  var prodBtn = document.getElementById('qc-mini-production');
  if (prodBtn) prodBtn.addEventListener('click', function() { qcMiniLoop('production'); });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeQcOverlay();
  });
}

// ----- Studio shell (UX Behavior Guide) -----

// Stage table — the single source of truth for both modes. A future product line
// (e.g. Research → Journalist) is remapped by editing data only, no markup surgery.
//   key   = stage key used by the stage registry and [data-stage]
//   label = Advance label; `easy` = Easy label (its presence puts the stage in the lane)
const ACE_STAGE_NAV = [
  { key: 'research', label: 'Research', easy: '1 · สินค้า' },
  { key: 'plan', label: 'Plan', easy: '2 · แผน/ผลิต' },
  { key: 'storyboard', label: 'Storyboard' },
  { key: 'production', label: 'Production' },
  { key: 'finalize', label: 'Finalize', easy: '3 · ตรวจ/อนุมัติ' },
  { key: 'schedule', label: 'Publish', easy: '4 · ลิงก์ + เผยแพร่' },
  { key: 'dashboard', label: 'Monitor', easy: '5 · ติดตาม' },
  { key: 'report', label: 'Report', easy: '6 · รายงาน' },
];

// Derived lists — never maintained by hand, so they cannot drift from the table.
const STUDIO_STAGES = ACE_STAGE_NAV.map(function(step) { return step.key; });
const ACE_EASY_STAGE_KEYS = ACE_STAGE_NAV
  .filter(function(step) { return Boolean(step.easy); })
  .map(function(step) { return step.key; });

function markActiveNav(stageKey) {
  document.querySelectorAll('.footer-nav-btn').forEach(function(btn) {
    const active = btn.dataset.stage === stageKey;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function renderStageNav() {
  const mode = currentMode();
  const keys = stageKeysForMode(mode);
  const steps = ACE_STAGE_NAV.filter(function(step) { return keys.indexOf(step.key) !== -1; });
  const currentStage = keys.indexOf(document.body.dataset.stage) !== -1 ? document.body.dataset.stage : steps[0].key;

  const nav = document.querySelector('.footer-nav');
  if (nav) {
    nav.dataset.mode = mode;
    nav.innerHTML = steps.map(function(step, i) {
      const label = mode === 'easy' && step.easy ? step.easy : step.label;
      return (i > 0 ? '<span class="nav-sep" aria-hidden="true">-</span>' : '') +
        '<button type="button" class="footer-nav-btn stage-' + step.key + '" data-stage="' + step.key +
        '" aria-pressed="false"><span class="nav-label">' + label + '</span></button>';
    }).join('');
  }
  // Highlighting (track + counter) lives only in updateStudioStage().
  const track = document.getElementById('stage-track');
  if (track) track.innerHTML = steps.map(function() { return '<span></span>'; }).join('');

  markActiveNav(currentStage);
  updateStudioStage(currentStage);
  updateModeToggle();
}

let selectedCandidateId = null;

function currentCandidate() {
  return candidatePool.find(function(c) { return c.id === selectedCandidateId; }) || null;
}

function starsFor(rating) {
  var value = Math.round(Number(rating) || 0);
  var stars = '';
  for (var i = 1; i <= 5; i++) stars += i <= value ? '★' : '☆';
  return stars;
}

/** The link/channel panel and the presentation tabs only mean something once a product is selected. */
function setSelectionPanelsVisible(visible) {
  ['affiliate-panel', 'detail-content-tabs'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', !visible);
  });
}

function renderCandidateHero() {
  var c = currentCandidate();
  var name = document.getElementById('hero-name');
  var note = document.getElementById('hero-note');
  var rating = document.getElementById('hero-rating');
  var stars = document.getElementById('hero-stars');
  var sold = document.getElementById('hero-sold');
  var price = document.getElementById('hero-price');
  var image = document.getElementById('hero-image');
  if (!name) return;

  if (!c) {
    name.textContent = '— เลือกสินค้าจากรายการด้านซ้าย —';
    if (note) note.textContent = 'กดการ์ดสินค้าเพื่อดูรายละเอียด แล้วส่งเข้า queue หรือสร้างคอนเทนต์';
    if (rating) rating.textContent = '—';
    if (stars) stars.textContent = '☆☆☆☆☆';
    if (sold) sold.textContent = '—';
    if (price) price.textContent = '฿—';
    if (image) { image.hidden = true; image.removeAttribute('src'); }
    renderCandidateTabs(null);
    renderAffiliatePanel();
    setSelectionPanelsVisible(false);
    return;
  }

  setSelectionPanelsVisible(true);
  name.textContent = c.name;
  if (note) {
    note.textContent = [c.shopName, c.category, c.evidence].filter(Boolean).join(' · ') || 'สินค้าจาก Shopee';
  }
  if (rating) rating.textContent = c.rating ? c.rating + ' / 5' : 'ยังไม่มีคะแนน';
  if (stars) stars.textContent = starsFor(c.rating);
  if (sold) sold.textContent = c.sold || '—';
  if (price) price.textContent = c.price ? '฿' + Number(c.price).toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '฿—';
  if (image) {
    if (c.image) { image.src = c.image; image.hidden = false; }
    else { image.removeAttribute('src'); image.hidden = true; }
  }
  renderCandidateTabs(c);
  renderAffiliatePanel();
}

function renderCandidateTabs(c) {
  var presentation = document.getElementById('tab-presentation');
  var reason = document.getElementById('tab-reason');
  var opportunity = document.getElementById('tab-opportunity');
  if (!presentation || !reason || !opportunity) return;

  if (!c) {
    presentation.innerHTML = '<li>เลือกสินค้าเพื่อดูแนวทางการนำเสนอ</li>';
    reason.innerHTML = '<li>เหตุผลจากราคา ค่าคอมมิชชัน และคะแนนร้านจะแสดงที่นี่</li>';
    opportunity.innerHTML = '<li>โอกาสและมุมคอนเทนต์จะแสดงที่นี่</li>';
    return;
  }

  var commission = Number(c.commission) || 0;
  var price = Number(c.price) || 0;
  var rate = price > 0 ? Math.round((commission / price) * 1000) / 10 : 0;
  var priceText = price > 0 ? '฿' + price.toLocaleString('th-TH') : '—';

  presentation.innerHTML = [
    '<li><b>Hook:</b> เปิดด้วยปัญหาที่สินค้าแก้ได้ แล้วโชว์ราคา ฿' + price.toLocaleString('th-TH') + ' ให้เห็นชัดใน 3 วินาทีแรก</li>',
    '<li><b>Action:</b> สาธิตการใช้งานจริง 1 ฉาก พร้อมซูมจุดขาย' + (c.shopName ? ' ของร้าน ' + c.shopName : '') + '</li>',
    '<li><b>Payoff:</b> สรุปคะแนน ' + (c.rating ? c.rating + '/5' : '—') + ' และยอดขาย ' + (c.sold || '—') + '</li>',
    '<li><b>CTA:</b> ปิดด้วยลิงก์ตะกร้า + เตือนให้ตรวจสอบราคาก่อนซื้อ</li>'
  ].join('');

  reason.innerHTML = [
    '<li>ราคา ฿' + price.toLocaleString('th-TH') + ' อยู่ในช่วงที่คนตัดสินใจซื้อเร็ว</li>',
    '<li>ค่าคอมมิชชัน ฿' + commission.toLocaleString('th-TH') + (rate ? ' (~' + rate + '% ของราคา)' : '') + '</li>',
    '<li>สถานะความน่าสนใจ: <b>' + (c.quality || '—') + '</b></li>',
    '<li>คะแนนร้าน ' + (c.rating || '—') + ' และยอดขาย ' + (c.sold || '—') + '</li>'
  ].join('');

  opportunity.innerHTML = [
    '<li>ทำคอนเทนต์ได้หลายมุม: รีวิวสั้น, เปรียบเทียบ, แก้ปัญหาใช้งานจริง</li>',
    '<li>ถ้าค่าคอมสูงกว่า ฿100 ควรจัดเป็นสินค้าเรือธงของสัปดาห์</li>',
    '<li>ใช้ภาพ Snap เป็นหลักฐานประกอบ และเก็บลิงก์ affiliate ไว้ใน Source Library</li>'
  ].join('');
}

function renderStudioMeta() {
  var high = candidatePool.filter(function(c) { return c.quality === 'High'; }).length;
  var medium = candidatePool.filter(function(c) { return c.quality === 'Medium'; }).length;
  var low = candidatePool.filter(function(c) { return c.quality !== 'High' && c.quality !== 'Medium'; }).length;
  var total = candidatePool.length || 1;

  var donut = document.getElementById('quality-donut');
  if (donut) {
    var a = (high / total) * 100;
    var b = a + (medium / total) * 100;
    donut.style.background = 'conic-gradient(var(--green) 0 ' + a + '%, var(--amber) ' + a + '% ' + b + '%, var(--red) ' + b + '% 100%)';
  }

  var set = function(id, value) { var el = document.getElementById(id); if (el) el.textContent = value; };
  set('donut-high', high);
  set('donut-medium', medium);
  set('donut-low', low);
  set('pool-count', candidatePool.length + ' รายการ');
  set('queue-count', String(publishQueue.length + contentLibrary.length));
  set('profile-meta', sourceItems.length + ' source · ' + candidatePool.length + ' candidate');

  renderScheduleQueue();
}

function renderScheduleQueue() {
  var host = document.getElementById('schedule-queue');
  if (!host) return;
  if (!candidatePool.length) {
    host.innerHTML = '<p class="muted small">ยังไม่มีสินค้าในคิว</p>';
    return;
  }
  host.innerHTML = candidatePool.slice(0, 5).map(function(c, i) {
    return '<div class="queue-item-mini" data-id="' + c.id + '">' +
      (c.image ? '<img src="' + c.image + '" alt="">' : '<img alt="" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMTQxMDJhIi8+PC9zdmc+">') +
      '<div><p class="queue-mini-title">' + c.name + '</p>' +
      '<p class="queue-mini-meta">#' + (i + 1) + ' · ' + (c.sold || 'ยังไม่มียอดขาย') + ' · ' + (c.quality || '—') + '</p></div>' +
      '<span class="queue-mini-price">' + (Number(c.price) > 0 ? '฿' + Number(c.price).toLocaleString('th-TH') : '—') + '</span>' +
      '</div>';
  }).join('');
}

function selectCandidate(id) {
  selectedCandidateId = id;
  document.querySelectorAll('.candidate-card').forEach(function(card) {
    card.classList.toggle('is-selected', Number(card.dataset.id) === id);
  });
  renderCandidateHero();
}

function studioStageOrder() {
  return Array.from(document.querySelectorAll('.footer-nav-btn'), function(btn) { return btn.dataset.stage; });
}

function updateStudioStage(stageKey) {
  const order = studioStageOrder();
  const index = Math.max(0, order.indexOf(stageKey));

  const track = document.getElementById('stage-track');
  if (track) {
    Array.prototype.forEach.call(track.children, function(seg, i) {
      seg.classList.toggle('is-on', i <= index);
    });
  }
  const counter = document.getElementById('stage-counter');
  if (counter) counter.textContent = (index + 1) + ' of ' + order.length;

  document.querySelectorAll('.rail-btn').forEach(function(btn) {
    btn.classList.toggle('is-active', btn.dataset.stage === stageKey);
  });
}

function studioGoStage(delta) {
  const order = studioStageOrder();
  const current = Math.max(0, order.indexOf(document.body.dataset.stage));
  const next = Math.min(order.length - 1, Math.max(0, current + delta));
  if (order[next]) switchStage(order[next]);
}

function bindStudioShell() {
  document.querySelectorAll('.studio-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.studio-tab').forEach(function(t) { t.classList.remove('is-active'); });
      document.querySelectorAll('.studio-tab-panel').forEach(function(p) { p.classList.remove('is-active'); });
      tab.classList.add('is-active');
      var panel = document.querySelector('.studio-tab-panel[data-panel="' + tab.dataset.tab + '"]');
      if (panel) panel.classList.add('is-active');
    });
  });

  document.querySelectorAll('.queue-tabs button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.queue-tabs button').forEach(function(b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      renderScheduleQueue();
    });
  });

  document.querySelectorAll('.rail-btn[data-stage]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchStage(btn.dataset.stage);
    });
  });

  var prev = document.getElementById('stage-prev');
  var next = document.getElementById('stage-next');
  if (prev) prev.addEventListener('click', function() { studioGoStage(-1); });
  if (next) next.addEventListener('click', function() { studioGoStage(1); });

  var send = document.getElementById('hero-send');
  if (send) {
    send.addEventListener('click', function() {
      var c = currentCandidate();
      if (!c) { showToast('เลือกสินค้าก่อนส่งเข้า queue', 'warning'); return; }
      moveCandidateToLibrary(c);
      renderStudioMeta();
    });
  }

  var draft = document.getElementById('hero-draft');
  if (draft) {
    draft.addEventListener('click', function() {
      var c = currentCandidate();
      if (!c) { showToast('เลือกสินค้าก่อนสร้าง Content', 'warning'); return; }
      openContentDraft(c.id);
    });
  }

}

// ----- Product Offer import (Shopee Affiliate = only data source) -----

let importedOffers = [];
let poolFilter = '';
let poolVisibleCount = 20;

/* ช่องทางที่ผูกกับ Shopee Affiliate — label คงที่, ส่วนชื่อบัญชี/handle
   อยู่ใน Settings (localStorage ace.channels.v1) ผ่าน channelHandle(id) */
const PUBLISH_CHANNELS = [
  { id: 'shopee_video', label: 'Shopee Video', note: 'ช่องทางหลัก' },
  { id: 'tiktok', label: 'TikTok (Organic)' },
  { id: 'x', label: 'X (Twitter) (Organic)' },
  { id: 'facebook', label: 'Facebook (Organic)' },
  { id: 'youtube', label: 'YouTube' },
];

function setOffersStatus(message, kind) {
  const el = document.getElementById('offers-status');
  if (!el) return;
  el.textContent = message;
  el.dataset.kind = kind || 'info';
}

function offerQuality(commission) {
  const value = Number(commission) || 0;
  if (value >= 100) return 'High';
  if (value >= 40) return 'Medium';
  return 'Low';
}

function nextCandidateId() {
  return candidatePool.reduce(function(max, c) { return Math.max(max, Number(c.id) || 0); }, 0) + 1;
}

function normalizeOffer(offer) {
  const price = Number(offer.price) || 0;
  const rate = Number(offer.commission_rate) || 0;
  const commission = Number(offer.commission_amount);
  return {
    name: String(offer.name || '').trim(),
    price: price,
    sold: offer.sold || null,
    commission_rate: rate || null,
    commission: Number.isFinite(commission) && commission > 0 ? commission : Math.round(price * rate) / 100,
    link: offer.link || '',
    shopName: offer.shopName || null,
    shopId: offer.shopId || null,
    itemId: offer.itemId || null,
    itemCode: offer.itemCode || null,
    stock: offer.stock || null,
  };
}

function renderOffersPreview() {
  const host = document.getElementById('offers-preview');
  if (!host) return;

  if (!importedOffers.length) {
    host.classList.add('hidden');
    host.innerHTML = '';
    return;
  }

  host.classList.remove('hidden');
  const rows = importedOffers.map(function(offer, index) {
    return '<label class="offer-row" data-index="' + index + '">' +
      '<input type="checkbox" checked>' +
      '<span><span class="offer-row-name">' + escapeHtml(offer.name) + '</span>' +
      '<span class="offer-row-meta">' + (offer.sold || 'ไม่ทราบยอดขาย') +
      (offer.link ? ' · มีลิงก์' : '') + '</span></span>' +
      '<span class="offer-row-price">' + (offer.price ? '฿' + offer.price.toLocaleString('th-TH') : '—') +
      '<span class="offer-row-rate">' + (offer.commission_rate ? offer.commission_rate + '% · ฿' + offer.commission.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : 'ค่าคอม —') + '</span></span>' +
      '</label>';
  }).join('');

  host.innerHTML = rows +
    '<div class="offers-preview-actions">' +
    '<button type="button" class="btn btn-sm btn-ghost" id="offers-select-all">เลือกทั้งหมด / ไม่เลือก</button>' +
    '<button type="button" class="btn btn-sm btn-primary" id="offers-add">เพิ่ม ' + importedOffers.length + ' รายการเข้าคลัง</button>' +
    '</div>';

  const selectAll = document.getElementById('offers-select-all');
  if (selectAll) {
    selectAll.addEventListener('click', function() {
      const boxes = host.querySelectorAll('.offer-row input');
      const makeChecked = Array.prototype.some.call(boxes, function(b) { return !b.checked; });
      boxes.forEach(function(b) { b.checked = makeChecked; });
    });
  }

  const add = document.getElementById('offers-add');
  if (add) add.addEventListener('click', addImportedOffers);
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}

function addImportedOffers() {
  const host = document.getElementById('offers-preview');
  if (!host) return;

  let added = 0;
  let skipped = 0;

  host.querySelectorAll('.offer-row').forEach(function(row) {
    const box = row.querySelector('input');
    if (!box || !box.checked) return;
    const offer = importedOffers[Number(row.dataset.index)];
    if (!offer || !offer.name) return;

    const duplicate = candidatePool.some(function(c) {
      if (offer.shopId && offer.itemId && String(c.shopId) === String(offer.shopId) && String(c.itemId) === String(offer.itemId)) return true;
      return c.name === offer.name && Number(c.price) === Number(offer.price);
    });
    if (duplicate) { skipped += 1; return; }

    candidatePool.push({
      id: nextCandidateId(),
      name: offer.name,
      platform: 'Shopee',
      price: offer.price,
      commission: offer.commission,
      commissionRate: offer.commission_rate,
      rating: null,
      sold: offer.sold,
      shopName: offer.shopName || null,
      shopId: offer.shopId || null,
      itemId: offer.itemId || null,
      affiliateLink: offer.link || '',
      subIds: { 1: '', 2: '', 3: '', 4: '', 5: '' },
      channels: ['shopee_video'],
      quality: offerQuality(offer.commission),
      status: 'DRAFT',
      views: 0,
      clicks: 0,
      estimatedSale: 0,
      evidence: 'Shopee Affiliate · ข้อเสนอ ผลิตภัณฑ์' + (offer.commission_rate ? ' (' + offer.commission_rate + '% ค่าคอม)' : ''),
    });
    added += 1;
  });

  renderCandidatePool();
  if (typeof seedSourceLibraryFromPool === 'function') seedSourceLibraryFromPool();
  if (typeof renderSourceLibrary === 'function') renderSourceLibrary();
  renderStudioMeta();

  showToast(
    added
      ? 'เพิ่ม ' + added + ' สินค้าเข้าคลังแล้ว' + (skipped ? ' (ข้ามซ้ำ ' + skipped + ')' : '')
      : 'ยังไม่มีสินค้าที่เลือก หรือมีอยู่ในคลังแล้ว',
    added ? 'success' : 'warning'
  );
}

async function fetchOffersWithAI() {
  const input = document.getElementById('offers-text');
  const button = document.getElementById('offers-ai');
  if (!input || !button) return;

  const raw = input.value.trim();
  if (!raw) {
    setOffersStatus('วางข้อความจากหน้า “ข้อเสนอ ผลิตภัณฑ์” ก่อนครับ', 'warning');
    input.focus();
    return;
  }

  button.disabled = true;
  setOffersStatus('AI กำลังอ่านรายการ… (อาจใช้เวลา 5–15 วินาที)', 'info');

  try {
    let attempts = 0;
    let list = [];
    while (attempts < 2 && list.length === 0) {
      attempts += 1;
      if (attempts > 1) setOffersStatus('AI ลองอ่านใหม่… (ครั้งที่ ' + attempts + ')', 'info');
      const response = await fetch('/api/mvp/snap/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: raw }),
      });
      const data = await response.json();
      list = (data && Array.isArray(data.offers) ? data.offers : []).map(normalizeOffer).filter(function(o) { return o.name; });
    }

    importedOffers = list;
    renderOffersPreview();

    if (importedOffers.length) {
      setOffersStatus('AI อ่านได้ ' + importedOffers.length + ' รายการ — ตรวจรายการแล้วกด “เพิ่มเข้าคลัง”', 'success');
    } else {
      setOffersStatus('AI ไม่พบสินค้าในข้อความนี้ — ลองกด “อ่านข้อเสนอทั้งหมด” แทน', 'error');
    }
  } catch (error) {
    setOffersStatus('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ' + error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

async function fetchOffersFromText() {
  const input = document.getElementById('offers-text');
  const button = document.getElementById('offers-fetch');
  if (!input || !button) return;

  const raw = input.value.trim();
  if (!raw) {
    setOffersStatus('วางข้อความจากหน้า “ข้อเสนอ ผลิตภัณฑ์” ก่อนครับ', 'warning');
    input.focus();
    return;
  }

  button.disabled = true;
  setOffersStatus('กำลังอ่านรายการ…', 'info');

  try {
    let response = await fetch('/api/mvp/offers/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: raw }),
    });
    let data = await response.json();

    if (!data || !Array.isArray(data.offers) || data.offers.length === 0) {
      setOffersStatus('รูปแบบข้อความไม่ตรง — ให้ AI ช่วยอ่านแทน…', 'info');
      response = await fetch('/api/mvp/snap/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: raw }),
      });
      data = await response.json();
    }

    const list = data && Array.isArray(data.offers) ? data.offers : [];
    importedOffers = list.map(normalizeOffer).filter(function(o) { return o.name; });
    renderOffersPreview();

    if (importedOffers.length) {
      setOffersStatus('อ่านได้ ' + importedOffers.length + ' รายการ — ตรวจรายการแล้วกด “เพิ่มเข้าคลัง”', 'success');
    } else {
      setOffersStatus('ไม่พบสินค้าในข้อความนี้ ลองคัดลอกทั้งหน้าใหม่ (Ctrl+A แล้วคัดลอก)', 'error');
    }
  } catch (error) {
    setOffersStatus('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ' + error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

function bindOffersImport() {
  const ruleButton = document.getElementById('offers-fetch');
  if (ruleButton && ruleButton.dataset.bound !== '1') {
    ruleButton.dataset.bound = '1';
    ruleButton.addEventListener('click', fetchOffersFromText);
  }

  const aiButton = document.getElementById('offers-ai');
  if (aiButton && aiButton.dataset.bound !== '1') {
    aiButton.dataset.bound = '1';
    aiButton.addEventListener('click', fetchOffersWithAI);
  }

  const csvButton = document.getElementById('offers-csv');
  const csvInput = document.getElementById('offers-csv-file');
  if (csvButton && csvInput && csvButton.dataset.bound !== '1') {
    csvButton.dataset.bound = '1';
    csvButton.addEventListener('click', function() { csvInput.click(); });
    csvInput.addEventListener('change', function() {
      const file = csvInput.files && csvInput.files[0];
      handleOffersCsvFile(file);
      csvInput.value = '';
    });
  }
}

// ----- CSV/TSV import from the Shopee Affiliate Offers export -----
//
// The Offers catalogue exports selected rows as a CSV/TSV with this header
// (Thai names, either delimiter):
//   รหัสสินค้า, ชื่อสินค้า, ราคา, ขาย, ชื่อร้านค้า, อัตราค่าคอมมิชชั่น,
//   คอมมิชชั่น, สินค้าคงคลัง, ลิงก์สินค้า, ลิงก์ข้อเสนอ
// Every field the card needs is present except the product image — the image
// is filled later via Capture or the card's click-to-add-URL placeholder.

const OFFERS_CSV_COLUMNS = {
  itemCode: ['รหัสสินค้า', 'item_id', 'itemid'],
  name: ['ชื่อสินค้า', 'item_name'],
  price: ['ราคา', 'price'],
  sold: ['ขาย', 'sold'],
  shopName: ['ชื่อร้านค้า', 'ร้านค้า', 'shop_name'],
  commissionRate: ['อัตราค่าคอมมิชชั่น', 'อัตราค่าคอมมิชชัน', 'commission_rate'],
  commission: ['คอมมิชชั่น', 'ค่าคอมมิชชั่น', 'commission'],
  stock: ['สินค้าคงคลัง', 'คงคลัง', 'stock'],
  productUrl: ['ลิงก์สินค้า', 'product_url'],
  offerLink: ['ลิงก์ข้อเสนอ', 'offer_link'],
};

const OFFERS_CSV_FALLBACK_ORDER = ['itemCode', 'name', 'price', 'sold', 'shopName', 'commissionRate', 'commission', 'stock', 'productUrl', 'offerLink'];

function detectDelimiter(firstLine) {
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return tabs > commas ? '\t' : ',';
}

function parseDelimited(text, delimiter) {
  const input = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i += 1; }
        else { inQuotes = false; }
      } else { field += ch; }
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === delimiter) { row.push(field); field = ''; continue; }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some(function(cell) { return String(cell).trim() !== ''; })) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  row.push(field);
  if (row.some(function(cell) { return String(cell).trim() !== ''; })) rows.push(row);
  return rows;
}

function offersCsvNumber(value) {
  const text = String(value == null ? '' : value).replace(/[^0-9.]/g, '');
  if (text === '') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function idsFromProductUrl(url) {
  const m = String(url || '').match(/\/product\/(\d+)\/(\d+)/);
  if (m) return { shopId: m[1], itemId: m[2] };
  return { shopId: null, itemId: null };
}

function offersFromCsv(text) {
  const probe = String(text || '').replace(/^\uFEFF/, '');
  const firstLine = probe.split(/\r?\n/, 1)[0] || '';
  const delimiter = detectDelimiter(firstLine);
  const rows = parseDelimited(probe, delimiter);
  if (rows.length < 1) return [];

  let map = {};
  const header = rows[0];
  const used = {};
  // Two passes: exact header match first, then containment — and a column may
  // only be claimed once, so "อัตราค่าคอมมิชชั่น" cannot be mistaken for the
  // "คอมมิชชั่น" (฿ amount) column.
  Object.keys(OFFERS_CSV_COLUMNS).forEach(function(key) {
    const names = OFFERS_CSV_COLUMNS[key];
    for (let i = 0; i < header.length; i++) {
      if (used[i]) continue;
      const cell = String(header[i] || '').trim().toLowerCase();
      if (names.some(function(n) { return cell === n.toLowerCase(); })) { map[key] = i; used[i] = true; return; }
    }
  });
  Object.keys(OFFERS_CSV_COLUMNS).forEach(function(key) {
    if (map[key] !== undefined) return;
    const names = OFFERS_CSV_COLUMNS[key];
    for (let i = 0; i < header.length; i++) {
      if (used[i]) continue;
      const cell = String(header[i] || '').trim().toLowerCase();
      if (names.some(function(n) { return cell.indexOf(n.toLowerCase()) !== -1; })) { map[key] = i; used[i] = true; return; }
    }
  });

  const hasHeader = header.some(function(cell) { return String(cell).indexOf('ชื่อสินค้า') !== -1; }) || Object.keys(map).length >= 5;
  if (!hasHeader) {
    map = {};
    OFFERS_CSV_FALLBACK_ORDER.forEach(function(key, index) { map[key] = index; });
  }

  const out = [];
  for (let r = hasHeader ? 1 : 0; r < rows.length; r++) {
    const cells = rows[r];
    const pick = function(key) {
      const index = map[key];
      return index === undefined || cells[index] === undefined ? '' : String(cells[index]).trim();
    };
    const name = pick('name');
    if (!name) continue;
    const price = offersCsvNumber(pick('price')) || 0;
    const rate = offersCsvNumber(pick('commissionRate'));
    const commission = offersCsvNumber(pick('commission'));
    const ids = idsFromProductUrl(pick('productUrl'));
    out.push({
      name: name,
      price: price,
      sold: pick('sold') || null,
      commission_rate: rate,
      commission: commission !== null ? commission : Math.round(price * (rate || 0)) / 100,
      link: pick('offerLink') || '',
      shopName: pick('shopName') || null,
      shopId: ids.shopId,
      itemId: ids.itemId,
      itemCode: pick('itemCode') || null,
      stock: pick('stock') || null,
    });
  }
  return out;
}

function handleOffersCsvFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function() {
    try {
      const list = offersFromCsv(String(reader.result || ''));
      if (!list.length) {
        setOffersStatus('อ่านไฟล์ไม่ได้ — ใช้ไฟล์ที่ดาวน์โหลดจากหน้า Offers (CSV/TSV) และต้องมีหัวคอลัมน์ "ชื่อสินค้า"', 'error');
        return;
      }
      importedOffers = list;
      renderOffersPreview();
      setOffersStatus('อ่านไฟล์ได้ ' + list.length + ' รายการ (ครบ: ราคา/ยอดขาย/ร้าน/ค่าคอม/ลิงก์) — ขาดเฉพาะรูป ตรวจรายการแล้วกด “เพิ่มเข้าคลัง”', 'success');
    } catch (error) {
      setOffersStatus('อ่านไฟล์ไม่สำเร็จ: ' + error.message, 'error');
    }
  };
  reader.readAsText(file, 'utf-8');
}

// ----- Affiliate link + publish channels -----

function currentChannelIds() {
  const c = currentCandidate();
  if (c && Array.isArray(c.channels) && c.channels.length) return c.channels;
  return ['shopee_video'];
}

function ensureCandidateSettings(c) {
  if (!c) return null;
  if (!Array.isArray(c.channels) || !c.channels.length) c.channels = ['shopee_video'];
  if (!c.subIds) c.subIds = { 1: '', 2: '', 3: '', 4: '', 5: '' };
  return c;
}

function renderAffiliatePanel() {
  const c = ensureCandidateSettings(currentCandidate());
  const link = document.getElementById('aff-link');
  const channels = document.getElementById('aff-channels');
  const estimate = document.getElementById('aff-estimate');
  if (!channels) return;

  if (link) link.value = c ? c.affiliateLink || '' : '';
  const state = document.getElementById('hero-link-state');
  if (state) state.textContent = c && c.affiliateLink ? 'มีลิงก์แล้ว' : 'ยังไม่มีลิงก์';

  // Per-candidate Call-to-Action: edited here, injected into the AI draft prompt.
  const ctaField = document.getElementById('aff-cta');
  if (ctaField) {
    if (document.activeElement !== ctaField) ctaField.value = c ? (c.cta || '') : '';
    if (ctaField.dataset.bound !== '1') {
      ctaField.dataset.bound = '1';
      ctaField.addEventListener('input', function() {
        const target = ensureCandidateSettings(currentCandidate());
        if (target) target.cta = ctaField.value.trim();
      });
    }
  }

  if (link) {
    link.placeholder = c
      ? 'ยังไม่มีลิงก์ — กด “เอา ลิงก์” ใน Shopee Affiliate แล้ววางที่นี่'
      : 'เลือกสินค้าก่อน';
  }

  channels.innerHTML = PUBLISH_CHANNELS.map(function(channel) {
    const active = c ? c.channels.indexOf(channel.id) !== -1 : channel.id === 'shopee_video';
    return '<button type="button" class="channel-chip' + (active ? ' is-on' : '') + '" data-channel="' + channel.id + '"' + (c ? '' : ' disabled') + '>' +
      escapeHtml(channel.label) + (channel.note ? ' <small>' + channel.note + '</small>' : '') + '</button>';
  }).join('');

  channels.querySelectorAll('.channel-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      const target = ensureCandidateSettings(currentCandidate());
      if (!target) return;
      const id = chip.dataset.channel;
      if (target.channels.indexOf(id) === -1) target.channels.push(id);
      else if (target.channels.length > 1) target.channels = target.channels.filter(function(x) { return x !== id; });
      else { showToast('ต้องเหลืออย่างน้อย 1 ช่องทาง', 'warning'); return; }
      renderAffiliatePanel();
      renderCandidateHero();
    });
  });

  if (estimate) {
    if (!c) {
      estimate.textContent = 'ค่าคอมมิชชันโดยประมาณจะแสดงตามอัตราของสินค้า';
    } else {
      const amount = Number(c.commission) || 0;
      const labels = c.channels.map(function(id) {
        const found = PUBLISH_CHANNELS.find(function(ch) { return ch.id === id; });
        return (found ? found.label : id) + ' ฿' + amount.toLocaleString('th-TH', { maximumFractionDigits: 2 });
      });
      estimate.textContent = 'ค่าคอมโดยประมาณต่อช่องทาง: ' + labels.join(' · ') +
        ' — อัตราเดียวกันทุกช่องทาง ตัวเลขจริงขึ้นกับ Shopee';
    }
  }
}

function buildAffiliateLink() {
  const c = ensureCandidateSettings(currentCandidate());
  if (!c) { showToast('เลือกสินค้าก่อน', 'warning'); return; }

  const field = document.getElementById('aff-link');
  const base = ((field && field.value) || c.affiliateLink || '').trim();
  if (base) c.affiliateLink = base;
  if (!base) { showToast('วางลิงก์ข้อเสนอสินค้าก่อนต่อ Sub_id', 'warning'); return; }

  const parts = [];
  for (let i = 1; i <= 5; i++) {
    const field = document.getElementById('aff-subid-' + i);
    c.subIds[i] = field ? field.value.trim() : c.subIds[i] || '';
    if (c.subIds[i]) parts.push('sub_id' + (i === 1 ? '' : i) + '=' + encodeURIComponent(c.subIds[i]));
  }

  if (parts.length) {
    const cleaned = base.split('#')[0];
    const joined = cleaned + (cleaned.indexOf('?') === -1 ? '?' : '&') + parts.join('&');
    c.affiliateLink = joined;
    const input = document.getElementById('aff-link');
    if (input) input.value = joined;
  }

  const channels = c.channels.map(function(id) {
    const found = PUBLISH_CHANNELS.find(function(ch) { return ch.id === id; });
    return found ? found.label : id;
  });
  showToast('ต่อ Sub_id แล้ว · จะเผยแพร่ที่ ' + channels.join(', '), 'success');
  renderAffiliatePanel();
}

function bindAffiliatePanel() {
  const toggle = document.getElementById('aff-advanced-toggle');
  const panel = document.getElementById('aff-advanced');
  if (toggle && panel && toggle.dataset.bound !== '1') {
    toggle.dataset.bound = '1';
    toggle.addEventListener('click', function() {
      panel.classList.toggle('hidden');
      toggle.classList.toggle('is-on');
    });
  }

  const build = document.getElementById('aff-build-link');
  if (build && build.dataset.bound !== '1') {
    build.dataset.bound = '1';
    build.addEventListener('click', buildAffiliateLink);
  }

}

// ===========================================================
// Actor Studio 1.0 — roster of generated AI actors, reusable
// across content and connected into Production.
// (2.0 จะแยกเป็นโมดูลต่างหาก)
// ===========================================================

const ACTOR_STORAGE_KEY = 'ace.actors.v1';
const ACTOR_MAX_IMAGE = 900 * 1024;

const ACTOR_ROLES = ['Presenter', 'Reviewer', 'Model', 'Character', 'Voice only'];
const ACTOR_TYPES = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'human', label: 'มนุษย์' },
  { id: 'cartoon_2d', label: 'การ์ตูน 2D' },
  { id: 'cartoon_3d', label: 'การ์ตูน 3D' },
  { id: 'mascot', label: 'มาสคอต' },
  { id: 'product', label: 'สินค้า / วัตถุ' },
];
let actorTypeFilter = 'all';
const ACTOR_STATUSES = ['พร้อมใช้', 'ร่าง'];

let actorRoster = [];
let actorSelectedId = null;

function loadActorRoster() {
  try {
    const raw = window.localStorage.getItem(ACTOR_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    actorRoster = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    actorRoster = [];
  }
  return actorRoster;
}

function saveActorRoster() {
  try {
    window.localStorage.setItem(ACTOR_STORAGE_KEY, JSON.stringify(actorRoster));
    return true;
  } catch (error) {
    showToast('บันทึกไม่สำเร็จ — พื้นที่เก็บข้อมูลเต็ม (ลองใช้ URL รูปแทนการอัปโหลด)', 'error');
    return false;
  }
}

function nextActorId() {
  return actorRoster.reduce(function(max, a) { return Math.max(max, Number(a.id) || 0); }, 0) + 1;
}

function actorById(id) {
  return actorRoster.find(function(a) { return Number(a.id) === Number(id); }) || null;
}

function actorUsageCount(id) {
  const fromPool = candidatePool.filter(function(c) { return Number(c.actorId) === Number(id); }).length;
  const fromLibrary = contentLibrary.filter(function(i) { return Number(i.actorId) === Number(id); }).length;
  return fromPool + fromLibrary;
}

function actorTypeLabel(id) {
  const found = ACTOR_TYPES.find(function(t) { return t.id === id; });
  return found ? found.label : 'มนุษย์';
}

function actorTags(actor) {
  return String(actor.tags || '')
    .split(',')
    .map(function(tag) { return tag.trim(); })
    .filter(Boolean);
}

function actorInitials(name) {
  const parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
  return parts.map(function(part) { return part.charAt(0); }).join('').toUpperCase();
}

// ----- Overlay rendering -----

function openActorStudio(actorId) {
  const overlay = document.getElementById('actor-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  if (actorId) actorSelectedId = Number(actorId);
  else if (!actorSelectedId && actorRoster.length) actorSelectedId = Number(actorRoster[0].id);
  renderActorStudio();
}

function closeActorStudio() {
  const overlay = document.getElementById('actor-overlay');
  if (overlay) overlay.classList.add('hidden');
  setPanelExpanded('actor-overlay', false);
}

function renderActorStudio() {
  const overlay = document.getElementById('actor-overlay');
  if (!overlay || overlay.classList.contains('hidden')) return;

  const search = document.getElementById('actor-search');
  const term = search ? search.value.trim().toLowerCase() : '';
  const list = document.getElementById('actor-list');
  const count = document.getElementById('actor-count');

  const typeHost = document.getElementById('actor-type-filter');
  if (typeHost) {
    typeHost.innerHTML = ACTOR_TYPES.map(function(type) {
      const count = type.id === 'all'
        ? actorRoster.length
        : actorRoster.filter(function(a) { return (a.type || 'human') === type.id; }).length;
      return '<button type="button" class="actor-type-chip' + (actorTypeFilter === type.id ? ' is-active' : '') + '" data-actor-type="' + type.id + '">' +
        type.label + ' <span class="queue-count">' + count + '</span></button>';
    }).join('');
  }

  const items = actorRoster.filter(function(actor) {
    if (actorTypeFilter !== 'all' && (actor.type || 'human') !== actorTypeFilter) return false;
    if (!term) return true;
    const haystack = [actor.name, actor.role, actor.voice, actor.tags, actor.language, actorTypeLabel(actor.type)].join(' ').toLowerCase();
    return haystack.indexOf(term) !== -1;
  });

  if (count) count.textContent = actorRoster.length + ' นักแสดง';

  if (list) {
    if (!items.length) {
      list.innerHTML = '<p class="muted small">' +
        (actorRoster.length ? 'ไม่พบนักแสดงที่ตรงกับคำค้น' : 'ยังไม่มีนักแสดง — กด “+ นักแสดงใหม่” เพื่อเริ่ม') + '</p>';
    } else {
      list.innerHTML = items.map(function(actor) {
        const active = Number(actor.id) === Number(actorSelectedId);
        const avatar = actor.image
          ? '<img class="actor-avatar" src="' + actor.image + '" alt="">'
          : '<span class="actor-avatar actor-avatar-text" title="ยังไม่มีรูปโปรไฟล์ — แก้ไขนักแสดงเพื่ออัปโหลด">' +
            escapeHtml(actorInitials(actor.name)) + '</span>';
        return '<button type="button" class="actor-row' + (active ? ' is-active' : '') + '" data-actor="' + actor.id + '">' +
          avatar +
          '<span class="actor-row-body"><span class="actor-row-name">' + escapeHtml(actor.name) + '</span>' +
          '<span class="actor-row-meta">' + escapeHtml(actorTypeLabel(actor.type)) + ' · ' + escapeHtml(actor.role || '—') + ' · ' + escapeHtml(actor.language || '—') + '</span>' +
          '<span class="actor-row-tags">' + actorTags(actor).slice(0, 3).map(function(tag) {
            return '<span class="actor-tag">' + escapeHtml(tag) + '</span>';
          }).join('') + '</span></span>' +
          '<span class="actor-row-use">' + actorUsageCount(actor.id) + ' งาน</span>' +
          '</button>';
      }).join('');
    }
  }

  const actor = actorById(actorSelectedId);
  const form = document.getElementById('actor-form');
  if (form) form.classList.toggle('hidden', !actor);
  const empty = document.getElementById('actor-empty');
  if (empty) empty.classList.toggle('hidden', !!actor);
  const preview = document.getElementById('actor-preview');
  if (preview) {
    preview.innerHTML = actor
      ? (actor.image
        ? '<img src="' + actor.image + '" alt="' + escapeHtml(actor.name) + '">'
        : '<span class="actor-preview-initials">' + escapeHtml(actorInitials(actor.name)) + '</span>') +
        '<div class="actor-preview-meta"><b>' + escapeHtml(actor.name) + '</b>' +
        '<span>' + escapeHtml(actor.role || '—') + ' · ' + escapeHtml(actor.status || 'ร่าง') + '</span></div>'
      : '';
  }
  const hint = document.getElementById('actor-used');
  if (hint) hint.textContent = actor ? 'ใช้แล้ว ' + actorUsageCount(actor.id) + ' งาน' : '';

  fillActorForm(actor);
}

function fillActorForm(actor) {
  const set = function(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value == null ? '' : value;
  };
  if (!actor) return;
  set('actor-name', actor.name);
  set('actor-role', actor.role || ACTOR_ROLES[0]);
  set('actor-type', actor.type || 'human');
  set('actor-status', actor.status || ACTOR_STATUSES[0]);
  set('actor-language', actor.language);
  set('actor-voice', actor.voice);
  set('actor-look', actor.look);
  set('actor-wardrobe', actor.wardrobe);
  set('actor-tags', actor.tags);
  set('actor-image-url', /^https?:/i.test(actor.image || '') ? actor.image : '');
  set('actor-notes', actor.notes);
  const file = document.getElementById('actor-image-file');
  if (file) file.value = '';
}

function readActorForm() {
  const value = function(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };
  return {
    name: value('actor-name'),
    role: value('actor-role'),
    type: value('actor-type'),
    status: value('actor-status'),
    language: value('actor-language'),
    voice: value('actor-voice'),
    look: value('actor-look'),
    wardrobe: value('actor-wardrobe'),
    tags: value('actor-tags'),
    imageUrl: value('actor-image-url'),
    notes: value('actor-notes'),
    file: document.getElementById('actor-image-file'),
  };
}

function saveActor() {
  const data = readActorForm();
  if (!data.name) { showToast('ใส่ชื่อนักแสดงก่อนบันทึก', 'warning'); return; }

  let actor = actorById(actorSelectedId);
  const isNew = !actor;
  if (isNew) {
    actor = { id: nextActorId(), createdAt: Date.now() };
    actorRoster.push(actor);
  }

  actor.name = data.name;
  actor.role = data.role;
  actor.type = data.type || 'human';
  actor.status = data.status;
  actor.language = data.language;
  actor.voice = data.voice;
  actor.look = data.look;
  actor.wardrobe = data.wardrobe;
  actor.tags = data.tags;
  actor.notes = data.notes;
  actor.updatedAt = Date.now();

  const applyImage = function(image) {
    actor.image = image || '';
    if (saveActorRoster()) {
      renderActorStudio();
      renderProductionActor();
      showToast(isNew ? 'เพิ่มนักแสดงใหม่แล้ว' : 'บันทึกข้อมูลนักแสดงแล้ว', 'success');
    }
  };

  const file = data.file && data.file.files && data.file.files[0];
  if (file) {
    if (file.size > ACTOR_MAX_IMAGE) {
      showToast('รูปใหญ่เกิน 900KB — ลดขนาดหรือใช้ URL', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = function() { applyImage(String(reader.result || '')); };
    reader.onerror = function() { showToast('อ่านไฟล์รูปไม่สำเร็จ', 'error'); };
    reader.readAsDataURL(file);
    return;
  }

  applyImage(data.imageUrl || (actor.image && !/^https?:/i.test(actor.image) ? actor.image : ''));
}

function newActor() {
  actorSelectedId = null;
  renderActorStudio();
  const form = document.getElementById('actor-form');
  if (form) form.classList.remove('hidden');
  const empty = document.getElementById('actor-empty');
  if (empty) empty.classList.add('hidden');
  const preview = document.getElementById('actor-preview');
  if (preview) preview.innerHTML = '<span class="actor-preview-initials">ใหม่</span>';
  const set = function(id, value) { const el = document.getElementById(id); if (el) el.value = value; };
  set('actor-name', '');
  set('actor-role', ACTOR_ROLES[0]);
  set('actor-type', 'human');
  set('actor-status', ACTOR_STATUSES[1]);
  set('actor-language', 'ไทย');
  set('actor-voice', '');
  set('actor-look', '');
  set('actor-wardrobe', '');
  set('actor-tags', '');
  set('actor-image-url', '');
  set('actor-notes', '');
  const file = document.getElementById('actor-image-file');
  if (file) file.value = '';
  const nameField = document.getElementById('actor-name');
  if (nameField) nameField.focus();
}

function duplicateActor() {
  const actor = actorById(actorSelectedId);
  if (!actor) { showToast('เลือกนักแสดงที่จะทำสำเนาก่อน', 'warning'); return; }
  const copy = Object.assign({}, actor, {
    id: nextActorId(),
    name: actor.name + ' (สำเนา)',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  actorRoster.push(copy);
  actorSelectedId = copy.id;
  if (saveActorRoster()) {
    renderActorStudio();
    showToast('ทำสำเนานักแสดงแล้ว — แก้ชื่อ/รายละเอียดต่อได้เลย', 'success');
  }
}

function deleteActor() {
  const actor = actorById(actorSelectedId);
  if (!actor) return;
  if (!window.confirm('ลบ “' + actor.name + '” ออกจาก Actor Studio?')) return;
  actorRoster = actorRoster.filter(function(a) { return Number(a.id) !== Number(actor.id); });
  candidatePool.forEach(function(c) { if (Number(c.actorId) === Number(actor.id)) c.actorId = null; });
  contentLibrary.forEach(function(i) { if (Number(i.actorId) === Number(actor.id)) i.actorId = null; });
  actorSelectedId = actorRoster.length ? Number(actorRoster[0].id) : null;
  if (saveActorRoster()) {
    renderActorStudio();
    renderProductionActor();
    showToast('ลบนักแสดงแล้ว', 'info');
  }
}

function useActorForCurrent() {
  const actor = actorById(actorSelectedId);
  const candidate = currentCandidate();
  if (!actor) { showToast('เลือกนักแสดงก่อน', 'warning'); return; }
  if (!candidate) { showToast('เลือกสินค้า/งานใน Production ก่อน', 'warning'); return; }

  candidate.actorId = actor.id;
  candidate.actorName = actor.name;
  if (typeof ensurePlan === 'function' && candidate) {
    var plan = ensurePlan(candidate);
    if (plan) plan.actorId = actor.id;
  }
  contentLibrary.forEach(function(item) {
    if (item.affiliateLink && item.affiliateLink === candidate.affiliateLink) {
      item.actorId = actor.id;
      item.actorName = actor.name;
    }
  });

  renderProductionActor();
  if (typeof renderPlanActor === 'function') renderPlanActor();
  if (typeof renderPlanStage === 'function') renderPlanStage();
  if (typeof renderStoryboardStage === 'function') renderStoryboardStage();
  if (typeof renderProductionStage === 'function') renderProductionStage();
  renderActorStudio();
  showToast('ผูก “' + actor.name + '” กับงานนี้แล้ว', 'success');
}

// ----- Production connector -----

function renderProductionActor() {
  const host = document.getElementById('production-actor-body');
  if (!host) return;

  const candidate = currentCandidate();
  const actor = candidate && candidate.actorId ? actorById(candidate.actorId) : null;

  if (actor) {
    const avatar = actor.image
      ? '<img class="actor-avatar" src="' + actor.image + '" alt="">'
      : '<span class="actor-avatar actor-avatar-text">' + escapeHtml(actorInitials(actor.name)) + '</span>';
    host.innerHTML = '<div class="prod-actor">' + avatar +
      '<div class="prod-actor-body"><p class="prod-actor-name">' + escapeHtml(actor.name) + '</p>' +
      '<p class="muted small">' + escapeHtml(actor.role || '—') + ' · ' + escapeHtml(actor.voice || 'ยังไม่กำหนดเสียง') +
      ' · ใช้แล้ว ' + actorUsageCount(actor.id) + ' งาน</p>' +
      '<p class="muted small">' + (candidate ? 'งาน: ' + escapeHtml(candidate.name) : 'ยังไม่ได้เลือกงาน') + '</p></div>' +
      '<button type="button" class="btn btn-sm btn-ghost" id="prod-actor-clear">ถอดออก</button></div>';
    const clear = document.getElementById('prod-actor-clear');
    if (clear) {
      clear.addEventListener('click', function() {
        if (candidate) { candidate.actorId = null; candidate.actorName = null; }
        renderProductionActor();
        showToast('ถอดนักแสดงออกจากงานนี้แล้ว', 'info');
      });
    }
    return;
  }

  if (!actorRoster.length) {
    host.innerHTML = '<p class="muted small">ยังไม่มีนักแสดงใน Actor Studio — สร้างนักแสดง AI ประจำบริษัทเพื่อใช้ซ้ำในทุกคอนเทนต์</p>';
    return;
  }

  host.innerHTML = '<p class="muted small">เลือกนักแสดงสำหรับงานนี้' + (candidate ? ' (' + escapeHtml(candidate.name) + ')' : '') + '</p>' +
    '<div class="prod-actor-picker">' +
    '<select id="prod-actor-select" class="form-input">' +
    actorRoster.map(function(a) { return '<option value="' + a.id + '">' + escapeHtml(a.name) + ' · ' + escapeHtml(a.role || '—') + '</option>'; }).join('') +
    '</select>' +
    '<button type="button" class="btn btn-sm btn-primary" id="prod-actor-assign">ใช้กับงานนี้</button>' +
    '</div>';

  const assign = document.getElementById('prod-actor-assign');
  if (assign) {
    assign.addEventListener('click', function() {
      const select = document.getElementById('prod-actor-select');
      actorSelectedId = select ? Number(select.value) : actorSelectedId;
      useActorForCurrent();
    });
  }
}

// ----- Generate an actor with AI (called from Actor Studio / Plan) -----

function setActorGenStatus(message, kind) {
  const el = document.getElementById('actor-gen-status');
  if (!el) return;
  el.textContent = message;
  el.dataset.kind = kind || 'info';
}

async function generateActorWithAI() {
  const briefField = document.getElementById('actor-gen-brief');
  const typeField = document.getElementById('actor-gen-type');
  const countField = document.getElementById('actor-gen-count');
  const run = document.getElementById('actor-gen-run');
  if (!briefField || !run) return;

  const brief = briefField.value.trim();
  if (!brief) { setActorGenStatus('พิมพ์โจทย์ก่อน เช่น “พรีเซนเตอร์หญิงไทย รีวิวเครื่องครัว”', 'error'); briefField.focus(); return; }

  run.disabled = true;
  setActorGenStatus('กำลังสร้างนักแสดง… (อาจใช้เวลา 5–15 วินาที)', 'info');

  try {
    const response = await fetch('/api/mvp/actors/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brief: brief,
        type: typeField ? typeField.value : 'human',
        count: countField ? Number(countField.value) : 1,
      }),
    });
    const data = await response.json();

    if (!data || !Array.isArray(data.actors) || !data.actors.length) {
      setActorGenStatus('สร้างไม่สำเร็จ: ' + ((data && data.message) || 'ไม่ได้รับข้อมูลนักแสดง'), 'error');
      return;
    }

    const added = [];
    data.actors.forEach(function(persona) {
      const actor = Object.assign({
        id: nextActorId(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'ร่าง',
        image: '',
      }, {
        name: persona.name,
        type: persona.type || 'human',
        role: persona.role,
        language: persona.language,
        voice: persona.voice,
        look: persona.look,
        wardrobe: persona.wardrobe,
        tags: persona.tags,
        notes: persona.notes,
      });
      actorRoster.push(actor);
      added.push(actor);
    });

    saveActorRoster();
    actorSelectedId = added[0].id;
    actorTypeFilter = 'all';
    renderActorStudio();
    renderPlanActor();
    renderProductionActor();

    setActorGenStatus('สร้างแล้ว ' + added.length + ' คน (สถานะร่าง) — ตรวจ/แก้รายละเอียดแล้วกด “ใช้กับงานนี้”', 'success');
    showToast('AI สร้างนักแสดง ' + added.length + ' คนเข้าคลังแล้ว', 'success');
  } catch (error) {
    setActorGenStatus('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ' + error.message, 'error');
  } finally {
    run.disabled = false;
  }
}

function openActorGenerator() {
  openActorStudio();
  const panel = document.getElementById('actor-gen');
  if (panel) panel.classList.remove('hidden');
  const brief = document.getElementById('actor-gen-brief');
  if (brief) brief.focus();
}

function bindActorStudio() {
  loadActorRoster();

  const open = document.getElementById('open-actor-studio');
  if (open && open.dataset.bound !== '1') {
    open.dataset.bound = '1';
    open.addEventListener('click', function() { openActorStudio(); });
  }

  const legacy = document.getElementById('add-actor');
  if (legacy && legacy.dataset.bound !== '1') {
    legacy.dataset.bound = '1';
    legacy.addEventListener('click', function(event) {
      event.preventDefault();
      openActorStudio();
    });
  }

  const overlay = document.getElementById('actor-overlay');
  if (overlay && overlay.dataset.bound !== '1') {
    overlay.dataset.bound = '1';

    overlay.addEventListener('click', function(event) {
      const typeChip = event.target.closest('[data-actor-type]');
      if (typeChip) { actorTypeFilter = typeChip.dataset.actorType; renderActorStudio(); return; }

      const row = event.target.closest('[data-actor]');
      if (row) { actorSelectedId = Number(row.dataset.actor); renderActorStudio(); return; }
      if (event.target.closest('#actor-close')) { closeActorStudio(); return; }
      if (event.target.closest('#actor-gen-toggle')) {
        const panel = document.getElementById('actor-gen');
        if (panel) panel.classList.toggle('hidden');
        return;
      }
      if (event.target.closest('#actor-gen-run')) { generateActorWithAI(); return; }
      if (event.target.closest('#actor-new')) { newActor(); return; }
      if (event.target.closest('#actor-save')) { saveActor(); return; }
      if (event.target.closest('#actor-duplicate')) { duplicateActor(); return; }
      if (event.target.closest('#actor-delete')) { deleteActor(); return; }
      if (event.target.closest('#actor-use')) { useActorForCurrent(); return; }
      if (event.target === overlay) closeActorStudio();
    });

    const search = document.getElementById('actor-search');
    if (search) search.addEventListener('input', renderActorStudio);

    const urlField = document.getElementById('actor-image-url');
    if (urlField) {
      urlField.addEventListener('change', function() {
        const actor = actorById(actorSelectedId);
        const preview = document.getElementById('actor-preview');
        if (preview && urlField.value.trim()) {
          preview.innerHTML = '<img src="' + urlField.value.trim() + '" alt=""><div class="actor-preview-meta"><b>' +
            escapeHtml((document.getElementById('actor-name') || {}).value || 'ตัวอย่าง') + '</b></div>';
        } else if (preview && actor) {
          renderActorStudio();
        }
      });
    }
  }

  renderProductionActor();
}

// ===========================================================
// Plan -> Storyboard breakdown -> Production
// Plan เป็นที่กำหนด เรื่องย่อ/รูปแบบฉาก/แสง/องค์ประกอบ/นักแสดง
// แล้วแยกย่อยเป็น shot list บน Storyboard ก่อนส่งเข้า Production
// ===========================================================

const PLAN_SHOT_FORMATS = ['Medium shot', 'Wide shot', 'Close-up', 'Top-down flat lay', 'Handheld POV'];
const PLAN_LIGHTING = ['Soft daylight', 'Studio key + fill', 'Warm practical light', 'Neon accent', 'Ring light'];
const PLAN_COMPOSITIONS = ['Center hero', 'Rule of thirds', 'Product in hand', 'Split screen', 'Text-safe left'];

function sbPad(n) { return String(n).padStart(2, '0'); }

function sbTimecode(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const mm = Math.floor(total / 60);
  const ss = Math.floor(total % 60);
  const ff = Math.round((total % 1) * 30) % 30;
  return sbPad(mm) + ':' + sbPad(ss) + ':' + sbPad(ff);
}

function defaultBeats() {
  return [
    { id: 'hook', start: 0, end: 3, label: 'Hook', action: 'เปิดด้วยปัญหาที่สินค้าแก้ + โชว์ราคา' },
    { id: 'demo', start: 3, end: 10, label: 'Demo', action: 'สาธิตการใช้งานจริง 1 ฉาก' },
    { id: 'proof', start: 10, end: 22, label: 'Proof', action: 'ซูมจุดขาย + คะแนน/ยอดขาย' },
    { id: 'cta', start: 22, end: 30, label: 'CTA', action: 'ปิดด้วยลิงก์ตะกร้า + เตือนตรวจราคา' },
  ];
}

function ensurePlan(candidate) {
  if (!candidate) return null;
  if (!candidate.plan) {
    candidate.plan = {
      synopsis: '',
      contentType: 'live_action',
      shotFormat: PLAN_SHOT_FORMATS[0],
      lighting: PLAN_LIGHTING[1],
      composition: PLAN_COMPOSITIONS[0],
      actorId: candidate.actorId || null,
      beats: defaultBeats(),
      updatedAt: null,
    };
  }
  if (!Array.isArray(candidate.plan.beats) || !candidate.plan.beats.length) {
    candidate.plan.beats = defaultBeats();
  }
  if (!candidate.plan.contentType) candidate.plan.contentType = 'live_action';
  if (!Array.isArray(candidate.storyboard)) candidate.storyboard = [];
  return candidate.plan;
}

// ----- Plan stage -----

function renderPlanStage() {
  const panel = document.getElementById('plan-stage');
  if (!panel) return;

  const candidate = currentCandidate();
  ensurePlan(candidate);

  const work = document.getElementById('plan-work');
  if (work) work.textContent = candidate ? candidate.name : 'ยังไม่เลือกงาน — เลือกสินค้าในหน้า Research ก่อน';

  const form = document.getElementById('plan-form');
  if (form) form.classList.toggle('hidden', !candidate);
  const empty = document.getElementById('plan-empty');
  if (empty) empty.classList.toggle('hidden', !!candidate);
  if (!candidate) { renderPlanActor(); return; }

  const plan = candidate.plan;
  const set = function(id, value) { const el = document.getElementById(id); if (el) el.value = value == null ? '' : value; };
  set('plan-synopsis', plan.synopsis);
  set('plan-content-type', plan.contentType || 'live_action');
  set('plan-shot', plan.shotFormat);
  set('plan-lighting', plan.lighting);
  set('plan-composition', plan.composition);

  const beatHost = document.getElementById('plan-beats');
  if (beatHost) {
    beatHost.innerHTML = plan.beats.map(function(beat, index) {
      return '<div class="plan-beat" data-beat="' + index + '">' +
        '<div class="plan-beat-head"><span class="plan-beat-index">' + (index + 1) + '</span>' +
        '<span class="plan-beat-label">' + escapeHtml(beat.label) + '</span>' +
        '<span class="plan-beat-time">' + sbTimecode(beat.start) + ' → ' + sbTimecode(beat.end) + '</span></div>' +
        '<input type="text" class="plan-beat-action" value="' + escapeHtml(beat.action || '') + '" placeholder="สิ่งที่เกิดขึ้นในช่วงนี้">' +
        '<div class="plan-beat-times">' +
        '<label>เริ่ม (วิ)<input type="number" min="0" step="1" class="plan-beat-start" value="' + beat.start + '"></label>' +
        '<label>จบ (วิ)<input type="number" min="1" step="1" class="plan-beat-end" value="' + beat.end + '"></label>' +
        '</div></div>';
    }).join('');
  }

  renderPlanActor();
}

function renderPlanActor() {
  const host = document.getElementById('plan-actor');
  if (!host) return;

  const candidate = currentCandidate();
  const actor = candidate && candidate.plan && candidate.plan.actorId ? actorById(candidate.plan.actorId) : null;

  if (!candidate) {
    host.innerHTML = '<p class="muted small">เลือกงานก่อนจึงจะเลือกนักแสดงได้</p>';
    return;
  }

  const optional = candidate.plan.contentType !== 'live_action';
  const optionalNote = optional
    ? ' <span class="plan-optional">(รูปแบบนี้ไม่จำเป็นต้องมีนักแสดง — ใช้ภาพนิ่ง/Motion Graphic ได้)</span>'
    : '';

  if (!actor) {
    host.innerHTML = '<p class="muted small">ยังไม่ได้เลือกนักแสดง — เลือกจาก Actor Studio (มนุษย์ / การ์ตูน 2D-3D / มาสคอต) หรือไม่ใช้นักแสดงก็ได้' + optionalNote + '</p>' +
      '<div class="plan-actor-actions"><button type="button" class="btn btn-sm btn-primary" id="plan-actor-pick">เลือกนักแสดง</button>' +
      '<button type="button" class="btn btn-sm btn-outline" id="plan-actor-gen">✨ สร้างด้วย AI</button></div>';
  } else {
    const avatar = actor.image
      ? '<img class="actor-avatar" src="' + actor.image + '" alt="">'
      : '<span class="actor-avatar actor-avatar-text">' + escapeHtml(actorInitials(actor.name)) + '</span>';
    host.innerHTML = '<div class="prod-actor">' + avatar +
      '<div class="prod-actor-body"><p class="prod-actor-name">' + escapeHtml(actor.name) + '</p>' +
      '<p class="muted small">' + escapeHtml(actorTypeLabel(actor.type)) + ' · ' + escapeHtml(actor.role || '—') + ' · ' + escapeHtml(actor.voice || 'ยังไม่กำหนดเสียง') + '</p></div>' +
      '<button type="button" class="btn btn-sm btn-ghost" id="plan-actor-pick">เปลี่ยน</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" id="plan-actor-clear">ถอดออก</button></div>';
  }

  const pick = document.getElementById('plan-actor-pick');
  if (pick) pick.addEventListener('click', function() { openActorStudio(candidate.plan.actorId || undefined); });

  const gen = document.getElementById('plan-actor-gen');
  if (gen) gen.addEventListener('click', function() { openActorGenerator(); });

  const clear = document.getElementById('plan-actor-clear');
  if (clear) {
    clear.addEventListener('click', function() {
      candidate.plan.actorId = null;
      candidate.actorId = null;
      candidate.actorName = null;
      renderPlanActor();
      showToast('ถอดนักแสดงออกจากแผนแล้ว', 'info');
    });
  }
}

function readPlanForm() {
  const candidate = currentCandidate();
  if (!candidate) return null;
  const plan = ensurePlan(candidate);
  const val = function(id) { const el = document.getElementById(id); return el ? el.value : ''; };

  plan.synopsis = val('plan-synopsis').trim();
  plan.contentType = val('plan-content-type') || 'live_action';
  plan.shotFormat = val('plan-shot');
  plan.lighting = val('plan-lighting');
  plan.composition = val('plan-composition');

  document.querySelectorAll('#plan-beats .plan-beat').forEach(function(row, index) {
    const beat = plan.beats[index];
    if (!beat) return;
    const action = row.querySelector('.plan-beat-action');
    const start = row.querySelector('.plan-beat-start');
    const end = row.querySelector('.plan-beat-end');
    if (action) beat.action = action.value.trim();
    if (start) beat.start = Number(start.value) || 0;
    if (end) beat.end = Number(end.value) || beat.start + 1;
  });

  plan.updatedAt = Date.now();
  return plan;
}

function savePlan(quiet) {
  const plan = readPlanForm();
  if (!plan) return null;
  if (!quiet) showToast('บันทึกแผนแล้ว', 'success');
  renderStoryboardStage();
  return plan;
}

// ----- Storyboard breakdown -----

function generateBreakdown() {
  const candidate = currentCandidate();
  if (!candidate) { showToast('เลือกงานก่อนแยกย่อย', 'warning'); return; }
  const plan = savePlan(true);

  const shots = [];
  plan.beats.forEach(function(beat, index) {
    const duration = Math.max(1, beat.end - beat.start);
    const split = beat.start + Math.round(duration * 0.6);
    shots.push({
      id: (index + 1) + 'a',
      start: beat.start,
      end: split,
      shotFormat: plan.contentType === 'live_action' ? plan.shotFormat
        : (plan.contentType === 'still' ? 'ภาพนิ่งสินค้า' : 'Motion graphic still'),
      lighting: plan.lighting,
      composition: plan.composition,
      action: beat.action,
      beat: beat.label,
      actorRequired: plan.contentType === 'live_action' && !!plan.actorId,
      contentType: plan.contentType,
    });
    shots.push({
      id: (index + 1) + 'b',
      start: split,
      end: beat.end,
      shotFormat: plan.contentType === 'live_action' ? 'Close-up' : (plan.contentType === 'still' ? 'ภาพนิ่งสินค้า' : 'Motion graphic still'),
      lighting: plan.lighting,
      composition: plan.composition === 'Center hero' ? 'Product in hand' : plan.composition,
      action: beat.action,
      beat: beat.label,
      actorRequired: plan.contentType === 'live_action' && !!plan.actorId,
      contentType: plan.contentType,
    });
  });

  candidate.storyboard = shots;
  renderStoryboardStage();
  switchStage('storyboard');
  showToast('แยกย่อยเป็น ' + shots.length + ' ช็อตบน Storyboard แล้ว', 'success');
}

function renderStoryboardStage() {
  const panel = document.getElementById('storyboard-stage');
  if (!panel) return;

  const candidate = currentCandidate();
  const host = document.getElementById('sb-list');
  const head = document.getElementById('sb-work');
  const count = document.getElementById('sb-count');
  const actor = candidate && candidate.plan && candidate.plan.actorId ? actorById(candidate.plan.actorId) : null;

  if (head) head.textContent = candidate ? candidate.name : 'ยังไม่เลือกงาน';
  if (count) count.textContent = candidate && candidate.storyboard ? candidate.storyboard.length + ' ช็อต' : '';
  if (!host) return;

  if (!candidate) { host.innerHTML = '<p class="muted small">เลือกงานในหน้า Research ก่อน</p>'; return; }
  if (!candidate.storyboard || !candidate.storyboard.length) {
    host.innerHTML = '<p class="muted small">ยังไม่มี breakdown — กลับไปที่ Plan แล้วกด “แยกย่อยเป็น Breakdown”</p>';
    return;
  }

  const typeLabel = { live_action: 'Live action', motion_graphic: 'Motion Graphic', still: 'ภาพนิ่ง' }[candidate.storyboard[0].contentType || 'live_action'];
  host.innerHTML = '<div class="sb-actor">' +
    'รูปแบบ: <b>' + escapeHtml(typeLabel) + '</b> · ' +
    (actor ? 'นักแสดง: <b>' + escapeHtml(actor.name) + '</b> (' + escapeHtml(actorTypeLabel(actor.type)) + ')' : 'ไม่ใช้นักแสดง') +
    ' · แสง: ' + escapeHtml(candidate.storyboard[0].lighting) + '</div>' +
    candidate.storyboard.map(function(shot) {
      return '<div class="sb-row">' +
        '<span class="sb-time">' + sbTimecode(shot.start) + '<br>' + sbTimecode(shot.end) + '</span>' +
        '<span class="sb-shot">' + escapeHtml(shot.shotFormat) + '</span>' +
        '<span class="sb-meta">' + escapeHtml(shot.lighting) + '<br>' + escapeHtml(shot.composition) + '</span>' +
        '<span class="sb-action">' + escapeHtml(shot.action || '—') + '<small>' + escapeHtml(shot.beat || '') + '</small></span>' +
        '</div>';
    }).join('');
}

// ----- Production summary (downstream of storyboard) -----

function renderProductionStage() {
  const host = document.getElementById('production-body');
  if (!host) return;

  const candidate = currentCandidate();
  const plan = candidate ? ensurePlan(candidate) : null;
  const actor = plan && plan.actorId ? actorById(plan.actorId) : null;
  const shots = candidate && candidate.storyboard ? candidate.storyboard.length : 0;

  if (!candidate) { host.innerHTML = '<p class="muted small">เลือกงานก่อน</p>'; return; }
  if (!shots) {
    host.innerHTML = '<p class="muted small">งานนี้ยังไม่มี storyboard — เริ่มจาก Plan แล้วแยกย่อยก่อน</p>';
    return;
  }

  host.innerHTML = '<div class="prod-summary">' +
    '<p><b>' + escapeHtml(candidate.name) + '</b></p>' +
    '<p class="muted small">' + escapeHtml(plan.synopsis || 'ยังไม่มีเรื่องย่อ') + '</p>' +
    '<ul class="prod-facts">' +
    '<li>Storyboard: ' + shots + ' ช็อต</li>' +
    '<li>แสง: ' + escapeHtml(plan.lighting) + ' · องค์ประกอบ: ' + escapeHtml(plan.composition) + '</li>' +
    '<li>รูปแบบ: ' + escapeHtml({ live_action: 'Live action', motion_graphic: 'Motion Graphic', still: 'ภาพนิ่ง' }[plan.contentType || 'live_action']) + '</li>' +
    '<li>นักแสดง: ' + (actor ? escapeHtml(actor.name) + ' (' + escapeHtml(actorTypeLabel(actor.type)) + ')' : 'ไม่ใช้นักแสดง') + '</li>' +
    '</ul></div>' +
    '<div class="prod-actions">' +
    '<button type="button" class="btn btn-sm btn-outline" id="prod-open-plan">แก้ไข Plan</button>' +
    '<button type="button" class="btn btn-sm btn-ghost" id="prod-open-sb">ดู Storyboard</button>' +
    '</div>';

  const toPlan = document.getElementById('prod-open-plan');
  if (toPlan) toPlan.addEventListener('click', function() { switchStage('plan'); });
  const toSb = document.getElementById('prod-open-sb');
  if (toSb) toSb.addEventListener('click', function() { switchStage('storyboard'); });
}

function bindPlanStages() {
  const save = document.getElementById('plan-save');
  if (save && save.dataset.bound !== '1') {
    save.dataset.bound = '1';
    save.addEventListener('click', function() { savePlan(false); });
  }

  const breakdown = document.getElementById('plan-breakdown');
  if (breakdown && breakdown.dataset.bound !== '1') {
    breakdown.dataset.bound = '1';
    breakdown.addEventListener('click', generateBreakdown);
  }

  const contentType = document.getElementById('plan-content-type');
  if (contentType && contentType.dataset.bound !== '1') {
    contentType.dataset.bound = '1';
    contentType.addEventListener('change', function() {
      const candidate = currentCandidate();
      if (candidate && candidate.plan) candidate.plan.contentType = contentType.value;
      renderPlanActor();
    });
  }

  const synopsis = document.getElementById('plan-synopsis');
  if (synopsis && synopsis.dataset.bound !== '1') {
    synopsis.dataset.bound = '1';
    synopsis.addEventListener('input', function() {
      const candidate = currentCandidate();
      if (candidate && candidate.plan) candidate.plan.synopsis = synopsis.value;
    });
  }
}

// ===========================================================
// Capture bridge — reads the logged-in Shopee Affiliate Offer page
// from the user's own browser (no Open API permission needed) and
// hands the products to ACE through the page URL hash.
// ===========================================================

const CAPTURE_HASH_PREFIX = '#capture=';

function captureBookmarkletSource() {
  const script = [
    '(function(){',
    'var checked=document.querySelectorAll(\'input[type=checkbox]:checked\');',
    'var cards=[].slice.call(document.querySelectorAll(\'div,li,article\')).filter(function(el){',
    'var t=el.innerText||\'\';',
    'return /\u0e04\u0e48\u0e32\u0e04\u0e2d\u0e21\u0e21\u0e34\u0e0a\u0e0a\u0e31\u0e19\\s*[\\d.]+\\s*%/.test(t)&&el.querySelector(\'img\');',
    '});',
    'cards=cards.filter(function(el){return !cards.some(function(o){return o!==el&&el.contains(o);});});',
    'if(checked.length){cards=cards.filter(function(el){return el.querySelector(\'input[type=checkbox]:checked\');});}',
    'var items=cards.map(function(el){',
    'var t=el.innerText||\'\';',
    'var lines=t.split(\'\\n\').map(function(x){return x.trim();}).filter(Boolean);',
    'var pm=t.match(/[\u0e3f]\\s*([\\d,]+(?:\\.\\d{1,2})?)/);',
    'var rm=t.match(/\u0e04\u0e48\u0e32\u0e04\u0e2d\u0e21\u0e21\u0e34\u0e0a\u0e0a\u0e31\u0e19\\s*([\\d.]+)\\s*%/);',
    'var sm=t.match(/\u0e02\u0e32\u0e22\u0e44\u0e14\u0e49\\s*([^\\n]{1,20}?)\\s*\u0e0a\u0e34\u0e49\u0e19/);',
    'var img=el.querySelector(\'img\');',
    'var src=img?(img.currentSrc||img.src||\'\'):\'\';',
    'var a=el.querySelector(\'a[href]\');',
    'var name=lines.filter(function(l){return l.length>12&&!/^[\u0e3f\\d]/.test(l)&&!/\u0e04\u0e48\u0e32\u0e04\u0e2d\u0e21|\u0e02\u0e32\u0e22\u0e44\u0e14\u0e49|EXTRA/i.test(l);}).sort(function(x,y){return y.length-x.length;})[0]||\'\';',
    'return {name:name,price:pm?Number(pm[1].replace(/,/g,\'\')):null,commission_rate:rm?Number(rm[1]):null,sold:sm?(sm[1]+\' \u0e0a\u0e34\u0e49\u0e19\'):null,image:src,link:a?a.href:\'\'};',
    '}).filter(function(i){return i.name;});',
    'if(!items.length){alert(\'ACE: \u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e1a\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e19\u0e35\u0e49 \u2014 \u0e25\u0e2d\u0e07\u0e40\u0e25\u0e37\u0e48\u0e2d\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e43\u0e2b\u0e49\u0e42\u0e2b\u0e25\u0e14\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e01\u0e48\u0e2d\u0e19\');return;}',
    'var url=\'http://127.0.0.1:4173/mvp.html#capture=\'+encodeURIComponent(JSON.stringify({page:location.href,items:items}));',
    'window.open(url,\'_blank\');',
    '})();',
  ].join('');
  return 'javascript:' + encodeURIComponent(script);
}

function setCaptureStatus(message, kind) {
  const el = document.getElementById('capture-status');
  if (!el) return;
  el.textContent = message;
  el.dataset.kind = kind || 'info';
}

function normalizeCapturedItem(item) {
  if (!item || typeof item !== 'object') return null;
  const name = String(item.name || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!name) return null;
  const price = Number(item.price);
  const rate = Number(item.commission_rate);
  const commission = price > 0 && rate > 0 ? Math.round(price * rate) / 100 : null;
  return {
    name: name,
    price: Number.isFinite(price) && price > 0 ? price : null,
    sold: item.sold || null,
    commission_rate: Number.isFinite(rate) && rate > 0 ? rate : null,
    commission: commission,
    image: typeof item.image === 'string' && item.image ? item.image : null,
    link: typeof item.link === 'string' ? item.link : '',
  };
}

function importCapturedItems(rawItems) {
  const items = (Array.isArray(rawItems) ? rawItems : []).map(normalizeCapturedItem).filter(Boolean);
  if (!items.length) return { added: 0, skipped: 0 };

  let added = 0;
  let skipped = 0;

  items.forEach(function(item) {
    const duplicate = candidatePool.some(function(c) {
      return c.name === item.name && Number(c.price || 0) === Number(item.price || 0);
    });
    if (duplicate) { skipped += 1; return; }

    candidatePool.push({
      id: nextCandidateId(),
      name: item.name,
      platform: 'Shopee',
      price: item.price || 0,
      commission: item.commission || 0,
      commissionRate: item.commission_rate || null,
      rating: null,
      sold: item.sold,
      shopName: null,
      image: item.image,
      affiliateLink: '',
      sourceUrl: item.link,
      subIds: { 1: '', 2: '', 3: '', 4: '', 5: '' },
      channels: ['shopee_video'],
      quality: offerQuality(item.commission || 0),
      status: 'DRAFT',
      views: 0,
      clicks: 0,
      estimatedSale: 0,
      evidence: 'Capture จาก Shopee Affiliate (เบราว์เซอร์)',
    });
    added += 1;
  });

  renderCandidatePool();
  if (typeof seedSourceLibraryFromPool === 'function') seedSourceLibraryFromPool();
  if (typeof renderSourceLibrary === 'function') renderSourceLibrary();
  renderStudioMeta();
  return { added: added, skipped: skipped };
}

function readCaptureHash() {
  const hash = window.location.hash || '';
  if (hash.indexOf(CAPTURE_HASH_PREFIX) !== 0) return null;
  try {
    const payload = JSON.parse(decodeURIComponent(hash.slice(CAPTURE_HASH_PREFIX.length)));
    return payload && Array.isArray(payload.items) ? payload : null;
  } catch (error) {
    return null;
  }
}

function consumeCaptureHash() {
  const payload = readCaptureHash();
  if (!payload) return false;

  const result = importCapturedItems(payload.items);
  try {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch (error) {
    /* hash clearing is best effort */
  }

  switchStage('research');
  showToast(
    'Capture สำเร็จ: เพิ่ม ' + result.added + ' สินค้า' + (result.skipped ? ' (ข้ามซ้ำ ' + result.skipped + ')' : ''),
    result.added ? 'success' : 'warning'
  );
  setCaptureStatus('รับข้อมูลจากเบราว์เซอร์แล้ว ' + result.added + ' รายการ', 'success');
  return true;
}

function connectCaptureBridge() {
  const toggle = document.getElementById('capture-toggle');
  const panel = document.getElementById('capture-panel');
  const link = document.getElementById('capture-bookmarklet');
  const copy = document.getElementById('capture-copy');
  const source = captureBookmarkletSource();

  if (link) link.setAttribute('href', source);

  if (toggle && toggle.dataset.bound !== '1') {
    toggle.dataset.bound = '1';
    toggle.addEventListener('click', function() {
      if (panel) panel.classList.toggle('hidden');
      if (copy) copy.classList.toggle('hidden', !panel || panel.classList.contains('hidden'));
    });
  }

  if (copy && copy.dataset.bound !== '1') {
    copy.dataset.bound = '1';
    copy.addEventListener('click', function() {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(source).then(function() {
          setCaptureStatus('คัดลอกโค้ดแล้ว — สร้างบุ๊กมาร์กใหม่แล้ววางโค้ดนี้', 'success');
        }).catch(function() {
          setCaptureStatus('คัดลอกไม่สำเร็จ — ลากปุ่มไปที่แถบบุ๊กมาร์กแทน', 'error');
        });
      } else {
        setCaptureStatus('เบราว์เซอร์นี้ไม่ให้คัดลอกอัตโนมัติ — ลากปุ่มไปที่แถบบุ๊กมาร์กแทน', 'warning');
      }
    });
  }

  if (window.__captureHashBound !== '1') {
    window.__captureHashBound = '1';
    window.addEventListener('hashchange', function() { consumeCaptureHash(); });
  }

  consumeCaptureHash();
}

// ----- Boot -----

// ----- Theme (dark / light) -----
// The switch lives in Settings (nav ⚙); there is no top-bar theme button.

const THEME_KEY = 'ace.theme.v1';

function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function applyTheme(theme, persist) {
  const value = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = value;
  document.documentElement.style.colorScheme = value;
  document.querySelectorAll('[data-theme-choice]').forEach(function(btn) {
    btn.setAttribute('aria-pressed', btn.dataset.themeChoice === value ? 'true' : 'false');
  });
  if (!persist) return;
  try {
    localStorage.setItem(THEME_KEY, value);
  } catch (error) {
    // Storage blocked/full: the theme still applies for this session.
  }
}

function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (error) { saved = null; }
  applyTheme(saved || 'dark', false);
}

function bindThemeSwitch() {
  const host = document.querySelector('.theme-switch');
  if (!host || host.dataset.bound === '1') return;
  host.dataset.bound = '1';
  host.addEventListener('click', function(e) {
    const btn = e.target instanceof Element ? e.target.closest('[data-theme-choice]') : null;
    if (btn) applyTheme(btn.dataset.themeChoice, true);
  });
}

function boot() {
  initTheme();
  bindThemeSwitch();
  initDomElements();
  attachEventListeners();
  loadProfileState();
  loadChannelHandles();
  applyModeUi(true);
  bindProfileSwitcher();
  bindQcOverlay();
  bindReport();
  const easyProduceBtn = document.getElementById('hero-easy-produce');
  if (easyProduceBtn) easyProduceBtn.addEventListener('click', easyProduce);
  const modeToggleBtn = document.getElementById('mode-toggle');
  if (modeToggleBtn) modeToggleBtn.addEventListener('click', function() { setMode(currentMode() === 'easy' ? 'advance' : 'easy'); });

  const footerNav = document.querySelector('.footer-nav');
  if (footerNav) footerNav.addEventListener('click', function(e) {
    const btn = e.target.closest('.footer-nav-btn');
    if (btn) switchStage(btn.dataset.stage);
  });

  loadFixtures();
  refreshAiStatus();
  seedSourceLibraryFromPool();
  bindStudioShell();
  bindActorStudio();
  bindPlanStages();
  bindOffersImport();
  bindSourceLibraryRemove();
  connectCaptureBridge();
  bindAffiliatePanel();
  renderPublishQueue();
  initStage();
  updateProfileUi();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
