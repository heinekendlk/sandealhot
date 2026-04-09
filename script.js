
const state = {
  allDeals: [],
  filteredDeals: [],
  visibleCount: 8,
  step: 8,
};

const dealGrid = document.getElementById('dealGrid');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const sortFilter = document.getElementById('sortFilter');
const dealCount = document.getElementById('dealCount');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const emptyState = document.getElementById('emptyState');
const couponList = document.getElementById('couponList');
const filterLinkWrap = document.getElementById('filterLinkWrap');

async function init() {
  try {
    const response = await fetch('products.json');
    if (!response.ok) {
      throw new Error(`Lỗi hệ thống: Không tìm thấy tệp dữ liệu (HTTP ${response.status})`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('Dữ liệu sản phẩm không đúng định dạng JSON Array');
    }

    state.allDeals = data.map(item => ({
      ...item,
      discountPercent: calcDiscount(item.oldPrice, item.newPrice)
    }));

    buildCategoryOptions();

    // Đọc tham số từ URL khi tải trang
    const params = new URLSearchParams(window.location.search);
    if (params.has('q')) searchInput.value = params.get('q');
    if (params.has('cat')) categoryFilter.value = params.get('cat');
    if (params.has('sort')) sortFilter.value = params.get('sort');

    renderHero();
    renderCoupons();
    applyFilters();
    bindEvents();
    showIOSPrompt();
  } catch (error) {
    dealGrid.innerHTML = `<div class="empty-state"><h3>Lỗi tải dữ liệu</h3><p>${error.message}</p></div>`;
    console.error(error);
  }
}

function bindEvents() {
  searchInput.addEventListener('input', () => {
    state.visibleCount = state.step;
    applyFilters();
  });

  categoryFilter.addEventListener('change', () => {
    state.visibleCount = state.step;
    applyFilters();
  });

  sortFilter.addEventListener('change', () => {
    state.visibleCount = state.step;
    applyFilters();
  });

  // Tự động tải thêm khi cuộn (Infinite Scroll)
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && state.visibleCount < state.filteredDeals.length) {
      state.visibleCount += state.step;
      renderDeals();
    }
  }, { rootMargin: '200px' }); // Tải trước khi người dùng chạm hẳn đáy 200px
  observer.observe(loadMoreBtn);

  // Xử lý hiệu ứng co giãn Header khi cuộn trang (chủ yếu cho mobile)
  const header = document.querySelector('.site-header');
  const backToTopBtn = document.getElementById('backToTop');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('header-shrunk');
    } else {
      header.classList.remove('header-shrunk');
    }

    if (window.scrollY > 400) {
      backToTopBtn.classList.add('visible');
    } else {
      backToTopBtn.classList.remove('visible');
    }
  }, { passive: true });

  backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function calcDiscount(oldPrice, newPrice) {
  if (!oldPrice || oldPrice <= 0) return 0;
  return Math.round(((oldPrice - newPrice) / oldPrice) * 100);
}

function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
}

function buildCategoryOptions() {
  const categories = [...new Set(state.allDeals.map(item => item.category))];
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });
}

function renderHero() {
  if (!state.allDeals.length) return;

  const bestDeal = [...state.allDeals].sort((a, b) => b.discountPercent - a.discountPercent)[0];

  document.getElementById('heroTitle').textContent = bestDeal.title;
  document.getElementById('heroDiscount').textContent = `${bestDeal.discountPercent}%`;
  document.getElementById('heroCoupon').textContent = bestDeal.coupon || 'Không có';
  document.getElementById('heroCategory').textContent = bestDeal.category;
  document.getElementById('heroBtn').href = bestDeal.affiliateUrl || '#dealSection';

  const heroCard = document.getElementById('heroCard');
  if (heroCard && bestDeal.image) {
    heroCard.style.backgroundImage = `linear-gradient(90deg, rgba(255,255,255,0.95) 40%, rgba(255,255,255,0)), url('${bestDeal.image}')`;
  }
}

function renderCoupons() {
  const topCoupons = state.allDeals
    .filter(item => item.coupon)
    .sort((a, b) => b.discountPercent - a.discountPercent)
    .slice(0, 4);

  couponList.innerHTML = topCoupons.map(item => `
    <div class="coupon-item">
      <div>
        <div class="coupon-code">${item.coupon}</div>
        <small>${item.title}</small>
      </div>
      <button class="copy-btn" onclick="copyCoupon('${item.coupon}')">Copy</button>
    </div>
  `).join('');
}

function showIOSPrompt() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.navigator.standalone === true || 
                       window.matchMedia('(display-mode: standalone)').matches;

  if (isIOS && !isStandalone) {
    const prompt = document.getElementById('ios-prompt');
    if (!prompt) return;
    
    prompt.classList.remove('hidden');
    setTimeout(() => {
      prompt.style.opacity = '0';
      setTimeout(() => prompt.classList.add('hidden'), 1000);
    }, 10000); // Tự động ẩn sau 10 giây
  }
}

function applyFilters() {
  const keyword = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;
  const sortValue = sortFilter.value;

  // Cập nhật URL và Link chia sẻ
  const params = new URLSearchParams();
  if (keyword) params.set('q', keyword);
  if (category !== 'all') params.set('cat', category);
  if (sortValue !== 'featured') params.set('sort', sortValue);

  const newUrl = params.toString() ? `${window.location.origin}${window.location.pathname}?${params.toString()}` : window.location.origin + window.location.pathname;
  window.history.replaceState({}, '', newUrl);
  
  updateShareLinkUI(newUrl, params.toString());

  let results = [...state.allDeals].filter(item => {
    const matchKeyword =
      item.title.toLowerCase().includes(keyword) ||
      item.brand.toLowerCase().includes(keyword) ||
      item.category.toLowerCase().includes(keyword);

    const matchCategory = category === 'all' || item.category === category;

    return matchKeyword && matchCategory;
  });

  switch (sortValue) {
    case 'discount-desc':
      results.sort((a, b) => b.discountPercent - a.discountPercent);
      break;
    case 'price-asc':
      results.sort((a, b) => a.newPrice - b.newPrice);
      break;
    case 'price-desc':
      results.sort((a, b) => b.newPrice - a.newPrice);
      break;
    case 'sold-desc':
      results.sort((a, b) => b.sold - a.sold);
      break;
    default:
      results.sort((a, b) => {
        if (b.isHot !== a.isHot) return Number(b.isHot) - Number(a.isHot);
        return b.discountPercent - a.discountPercent;
      });
  }

  state.filteredDeals = results;
  renderDeals();
}

function updateShareLinkUI(fullUrl, hasParams) {
  const shareInput = document.getElementById('shareableLink');
  if (hasParams) {
    filterLinkWrap.classList.remove('hidden');
    shareInput.value = fullUrl;
  } else {
    filterLinkWrap.classList.add('hidden');
  }
}

function renderDeals() {
  const visibleDeals = state.filteredDeals.slice(0, state.visibleCount);
  dealCount.textContent = state.filteredDeals.length;

  if (!state.filteredDeals.length) {
    dealGrid.innerHTML = '';
    emptyState.classList.remove('hidden');
    loadMoreBtn.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  dealGrid.innerHTML = visibleDeals.map(item => `
    <article class="deal-card">
      <div class="deal-thumb">
        <a href="${item.affiliateUrl}" target="_blank" rel="nofollow sponsored noopener">
          <img src="${item.image}" alt="${escapeHtml(item.title)}" loading="lazy" />
        </a>
        <div class="badge-wrap">
          ${item.isHot ? '<span class="badge badge-hot">HOT</span>' : ''}
          ${item.tag ? `<span class="badge badge-tag">${item.tag}</span>` : ''}
          <span class="badge badge-sale">-${item.discountPercent}%</span>
        </div>
      </div>

      <div class="deal-content">
        <div class="deal-category">${item.category}</div>
        <h3 class="deal-title">
          <a href="${item.affiliateUrl}" target="_blank" rel="nofollow sponsored noopener">${item.title}</a>
        </h3>
        <div class="deal-brand">Thương hiệu: ${item.brand}</div>

        <div class="price-row">
          <span class="new-price">${formatPrice(item.newPrice)}</span>
          <span class="old-price">${formatPrice(item.oldPrice)}</span>
          <span class="discount-rate">Tiết kiệm ${item.discountPercent}%</span>
        </div>

        <div class="meta-row">
          <span>Đã bán: ${item.sold}</span>
          <span>Còn: ${item.stockPercent}%</span>
        </div>

        <div class="stock-bar">
          <div class="stock-fill" style="width: ${item.stockPercent}%"></div>
        </div>

        <div class="coupon-row">
          <div>
            <span>Mã giảm:</span>
            <strong>${item.coupon || 'Không có'}</strong>
          </div>
        </div>

        <div class="card-actions">
          <a href="${item.affiliateUrl}" target="_blank" rel="nofollow sponsored noopener" class="btn btn-primary">Xem giá</a>
          <button class="btn btn-secondary" onclick="shareDeal('${escapeJs(item.title)}', '${item.affiliateUrl}')">Chia sẻ</button>
        </div>
      </div>
    </article>
  `).join('');

  if (state.visibleCount >= state.filteredDeals.length) {
    loadMoreBtn.classList.add('hidden');
  } else {
    loadMoreBtn.classList.remove('hidden');
  }
}

function copyCoupon(code) {
  navigator.clipboard.writeText(code)
    .then(() => alert(`Đã copy mã: ${code}`))
    .catch(() => alert('Không thể copy mã.'));
}

function shareDeal(title, url) {
  if (navigator.share) {
    navigator.share({ title, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url)
      .then(() => alert('Đã copy link chia sẻ!'))
      .catch(() => window.open(url, '_blank'));
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJs(text) {
  return String(text).replace(/'/g, "\\'");
}

init();
