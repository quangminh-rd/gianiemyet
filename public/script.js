const webAppBaseURL = 'https://script.google.com/macros/s/AKfycbxHIHXy-uX4fkjBjFYLb0AyxS-GY2GzlbvCj8XThdTPW9F_FOBRv-vjcupcZcBlCJXX0A/exec';
let products = [];
let priceList = []; // Thêm biến lưu trữ bảng giá niêm yết

// Hàm mới: tải bảng giá niêm yết
async function loadPriceList() {
    const cacheKey = 'cachedPriceList';
    const cacheTimeKey = 'cachedPriceListTime';
    const cacheTimeLimit = 24 * 60 * 60 * 1000; // 24 giờ

    const now = Date.now();
    const cachedTime = parseInt(localStorage.getItem(cacheTimeKey), 10);
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData && cachedTime && now - cachedTime < cacheTimeLimit) {
        priceList = JSON.parse(cachedData);
        return;
    }

    try {
        const res = await fetch(`${webAppBaseURL}?mode=getBangGiaNiemYet&t=${now}`);
        const data = await res.json();
        priceList = data;
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(cacheTimeKey, now.toString());
    } catch (err) {
        console.error('Lỗi load bảng giá niêm yết:', err);
    }
}

// Hàm mới: tìm giá niêm yết dựa trên các điều kiện
function findUnitPrice() {
    if (!currentProduct) return null;

    const maSanPham = document.getElementById('field5').value;
    const tongSoCanh = document.getElementById('tong_so_canh')?.value || '';
    const soCanhDiDong = document.getElementById('so_canh_di_dong')?.value || '';
    const khoangTieuChuan = document.getElementById('khoang_tieu_chuan').value;
    const khungNhom = document.getElementById('khung_nhom')?.value || '';
    const mauLuoi = document.getElementById('mau_luoi')?.value || '';
    const mauRem = document.getElementById('mau_rem')?.value || '';

    return priceList.find(item =>
        item.ma_san_pham === maSanPham &&
        item.tong_so_canh.includes(tongSoCanh) &&
        (!soCanhDiDong || item.so_canh_di_dong.includes(soCanhDiDong)) &&
        item.khoang_tieu_chuan === khoangTieuChuan &&
        (!khungNhom || item.khung_nhom.toLowerCase().includes(khungNhom.toLowerCase())) &&
        (!mauLuoi || item.mau_luoi.toLowerCase().includes(mauLuoi.toLowerCase())) &&
        (!mauRem || item.mau_rem.toLowerCase().includes(mauRem.toLowerCase()))
    );
}

function normalizema_san_pham_cau_tao(raw) {
    const t = raw.trim();
    return t.length > 2 && t[1] === '.' ? t.slice(2) : t;
}

function computeExtraFactor(item) {
    const {
        ma_san_pham,
        nhom_san_pham,
        chieu_rong,
        chieu_cao,
        tong_so_canh,
        so_canh_di_dong,
        dien_tich,
        he_cua,
        so_khung_dung
    } = item;

    const ma_san_pham_cau_tao = normalizema_san_pham_cau_tao(ma_san_pham);

    // 1) CK19 / CC19 dạng D
    if (
        ["CK19.D.TK", "CK19.D.NK", "CC19.D.TK", "CC19.D.NK"].includes(ma_san_pham_cau_tao) &&
        chieu_rong >= 2 * chieu_cao
    ) return 0.1;

    // 2) CC19 dạng N
    if (
        ["CC19.N.TK", "CC19.N.NK"].includes(ma_san_pham_cau_tao) &&
        chieu_cao >= 2 * chieu_rong
    ) return 0.1;

    // 3–6) XS..N
    const listXS_N = [
        "XS18.N.2323", "XS18.N.2338", "XS18.N.2343",
        "XS21.N.2626", "XS21.N.2638", "XS21.N.2643",
        "XS21.N.4026", "XS21.N.4038", "XS21.N.4040", "XS21.N.4043"
    ];
    if (listXS_N.includes(ma_san_pham_cau_tao)) {
        if (
            nhom_san_pham !== "Cửa 2 trong 1" &&
            tong_so_canh === 2 && so_canh_di_dong === 0 &&
            chieu_rong < 1100
        ) return 0.1;
        if (
            nhom_san_pham === "Cửa 2 trong 1" &&
            tong_so_canh === 4 && so_canh_di_dong === 0 &&
            chieu_rong < 1100
        ) return 0.1;
        if (
            dien_tich >= 0.5 && dien_tich <= 1.6 &&
            chieu_cao >= 2.5 * chieu_rong
        ) {
            const fc = ma_san_pham.trim()[0];
            if (fc === "L") return 0.1;
            if (fc === "R" || fc === "K") return 0.07;
        }
    }

    // 7–10) XS..D
    const listXS_D = ["XS18.D.2323", "XS21.D.2626", "XS21.D.4040"];
    if (listXS_D.includes(ma_san_pham_cau_tao)) {
        if (
            chieu_cao < 1100 &&
            ((tong_so_canh === 2 && so_canh_di_dong === 0 && nhom_san_pham !== "Cửa 2 trong 1") ||
                (tong_so_canh === 4 && so_canh_di_dong === 0 && nhom_san_pham === "Cửa 2 trong 1"))
        ) return 0.1;
        if (
            dien_tich >= 0.5 && dien_tich <= 1.6 &&
            chieu_rong >= 2.5 * chieu_cao
        ) {
            const fc = ma_san_pham.trim()[0];
            if (fc === "L") return 0.1;
            if (fc === "R" || fc === "K") return 0.07;
        }
    }

    // 11) Cửa mở quay & không khung đứng
    if (he_cua === "Cửa mở quay" && so_khung_dung === 0) return -0.05;

    // 12) Cửa xếp lá
    if (
        he_cua === "Cửa xếp lá" &&
        dien_tich >= 1.2 && dien_tich <= 1.6 &&
        chieu_rong >= 2.5 * chieu_cao
    ) return 0.1;

    return 0;
}

function computeAdditionalCharge(item) {
    const {
        ma_san_pham, nhom_san_pham, he_cua,
        chieu_rong, chieu_cao, dien_tich,
        tong_so_canh, so_canh_di_dong, so_luong,
        khoi_luong,
        // cot_bs_i do bạn sinh giống mã sp:
        cot_bs_1, cot_bs_2, cot_bs_3, cot_bs_4, cot_bs_5,
        don_gia_niem_yet_npp,
        phan_tram_tang_rem,
        ray_lua_khac_chuan,
        mau_rem, mau_noi_la
    } = item;

    // chuẩn hoá ma_san_pham_cau_tao
    const ma_san_pham_cau_tao = normalizema_san_pham_cau_tao(ma_san_pham);

    // helper
    const inList = (v, arr) => arr.includes(v);
    const IFS = (...conds) => {
        for (let i = 0; i < conds.length; i += 2) {
            if (conds[i]) return conds[i + 1];
        }
        return 0;
    };

    // 1) Phần IFS lớn đầu tiên
    const part1 = IFS(
        // case A: XS...N, rộng<1100, có di động
        (
            inList(ma_san_pham_cau_tao, ["XS18.N.2323", "XS18.N.2338", "XS18.N.2343",
                "XS21.N.2626", "XS21.N.2638", "XS21.N.2643",
                "XS21.N.4026", "XS21.N.4040", "XS21.N.4038", "XS21.N.4043"])
            && chieu_rong < 1100
            && ((tong_so_canh === 1 && so_canh_di_dong > 0)
                || (tong_so_canh === 2 && so_canh_di_dong > 0))
        ),
        73252 * (tong_so_canh + so_canh_di_dong - 1) * chieu_cao / 1000 * so_luong,

        // case B: XS...N, rộng 1100–2200, ...
        (
            inList(ma_san_pham_cau_tao, ["XS18.N.2323", "XS18.N.2338", "XS18.N.2343",
                "XS21.N.2626", "XS21.N.2638", "XS21.N.2643",
                "XS21.N.4026", "XS21.N.4040", "XS21.N.4038", "XS21.N.4043"])
            && chieu_rong >= 1100 && chieu_rong < 2200
            && ((tong_so_canh === 2 && so_canh_di_dong > 0)
                || tong_so_canh > 2)
        ),
        73252 * (tong_so_canh + so_canh_di_dong - 2) * chieu_cao / 1000 * so_luong,

        // case C: XS...N, rộng 2200–2800, ...
        (
            inList(ma_san_pham_cau_tao, ["XS18.N.2323", "XS18.N.2338", "XS18.N.2343",
                "XS21.N.2626", "XS21.N.2638", "XS21.N.2643",
                "XS21.N.4026", "XS21.N.4040", "XS21.N.4038", "XS21.N.4043"])
            && chieu_rong >= 2200 && chieu_rong < 2800
            && ((tong_so_canh === 3 && so_canh_di_dong > 1)
                || tong_so_canh > 3)
        ),
        73252 * (tong_so_canh + so_canh_di_dong - 4) * chieu_cao / 1000 * so_luong,

        // case D: XS...D, cao<1100, có di động
        (
            inList(ma_san_pham_cau_tao, ["XS18.D.2323", "XS21.D.2626", "XS21.D.4040"])
            && chieu_cao < 1100
            && ((tong_so_canh === 1 && so_canh_di_dong > 0)
                || (tong_so_canh === 2 && so_canh_di_dong > 0))
        ),
        73252 * (tong_so_canh + so_canh_di_dong - 1) * chieu_rong / 1000 * so_luong,

        // case E: XS...D, cao 1100–2200, ...
        (
            inList(ma_san_pham_cau_tao, ["XS18.D.2323", "XS21.D.2626", "XS21.D.4040"])
            && chieu_cao >= 1100 && chieu_cao < 2200
            && ((tong_so_canh === 2 && so_canh_di_dong > 0)
                || tong_so_canh > 2)
        ),
        73252 * (tong_so_canh + so_canh_di_dong - 2) * chieu_rong / 1000 * so_luong,

        // case F: XS...D, cao 2200–2800, ...
        (
            inList(ma_san_pham_cau_tao, ["XS18.D.2323", "XS21.D.2626", "XS21.D.4040"])
            && chieu_cao >= 2200 && chieu_cao < 2800
            && ((tong_so_canh === 3 && so_canh_di_dong > 1)
                || tong_so_canh > 3)
        ),
        73252 * (tong_so_canh + so_canh_di_dong - 4) * chieu_rong / 1000 * so_luong,

        // case G: Cửa xếp lá, rộng≤1400, số cánh>1
        (
            he_cua === "Cửa xếp lá"
            && (chieu_rong <= 1400)
            && ((tong_so_canh === 1 && so_canh_di_dong > 0)
                || tong_so_canh > 1)
        ),
        don_gia_niem_yet_npp * 1.4 * chieu_cao / 1000 * so_luong - don_gia_niem_yet_npp * khoi_luong,

        // case H: Cửa xếp xích, mã XX23.M.6005, rộng≤800, diện tích>1.6
        (
            he_cua === "Cửa xếp xích"
            && ma_san_pham_cau_tao === "XX23.M.6005"
            && chieu_rong <= 800 && dien_tich > 1.6 && tong_so_canh === 1
        ),
        don_gia_niem_yet_npp * 0.8 * chieu_cao / 1000 * so_luong - don_gia_niem_yet_npp * khoi_luong,

        // case I: Cửa xếp xích, mã XX23.M.6005, rộng≤1300, diện tích>2.0, cánh>1
        (
            he_cua === "Cửa xếp xích"
            && ma_san_pham_cau_tao === "XX23.M.6005"
            && chieu_rong <= 1300 && dien_tich > 2.0 && tong_so_canh > 1
        ),
        don_gia_niem_yet_npp * 1.3 * chieu_cao / 1000 * so_luong - don_gia_niem_yet_npp * khoi_luong,

        // case J: Cửa xếp xích, mã XX23.H.6005, rộng≤800, diện tích>1.6
        (
            he_cua === "Cửa xếp xích"
            && ma_san_pham_cau_tao === "XX23.H.6005"
            && chieu_rong <= 800 && dien_tich > 1.6 && tong_so_canh === 1
        ),
        don_gia_niem_yet_npp * 0.8 * chieu_cao / 1000 * so_luong - don_gia_niem_yet_npp * khoi_luong,

        // case K: Cửa xếp xích, mã XX23.H.6005, rộng≤1400, diện tích>2.5, cánh>1
        (
            he_cua === "Cửa xếp xích"
            && ma_san_pham_cau_tao === "XX23.H.6005"
            && chieu_rong <= 1400 && dien_tich > 2.5 && tong_so_canh > 1
        ),
        don_gia_niem_yet_npp * 1.4 * chieu_cao / 1000 * so_luong - don_gia_niem_yet_npp * khoi_luong,

        // case L: Cửa xếp lá, rộng<1400, số cánh>1
        (he_cua === "Cửa xếp lá" && chieu_rong < 1400 && (tong_so_canh > 1 || so_canh_di_dong > 0)),
        91586 * (tong_so_canh + so_canh_di_dong - 1) * chieu_cao / 1000 * so_luong,

        // case M: Cửa xếp lá, rộng≥1400, cánh>1
        (he_cua === "Cửa xếp lá" && chieu_rong >= 1400 && tong_so_canh > 1 && so_canh_di_dong > 0),
        91586 * (tong_so_canh + so_canh_di_dong - 2) * chieu_cao / 1000 * so_luong,

        // nếu không match hết trên => 0
        0
    );

    // 2) Cộng thêm IF hệ 23/26/40/xích: rem
    const part2 = ["Cửa xếp hệ 23", "Cửa xếp hệ 26", "Cửa xếp hệ 40", "Cửa xếp xích"]
        .includes(he_cua)
        ? 272188 * Math.round(phan_tram_tang_rem / 100 * chieu_rong / 1000 * 105) * 0.0138 * chieu_cao / 1000 * so_luong
        : 0;

    // 3) IF ray khác chuẩn
    const part3 = ray_lua_khac_chuan > 0
        ? cot_bs_1 * (ray_lua_khac_chuan - chieu_rong) / 1000 * so_luong
        : 0;

    // 4) IF cửa xếp lá & lá nhựa & màu nội là Ghi
    const part4 = (he_cua === "Cửa xếp lá"
        && ["Lá nhựa Polycarbonate màu trong suốt", "Lá nhựa Polycarbonate màu trắng đục"]
            .includes(mau_rem)
        && mau_noi_la === "Ghi")
        ? cot_bs_3 * chieu_rong / 80 * chieu_cao / 1000 * so_luong
        : 0;

    // 5) IF cửa xếp xích & nội là Nhôm
    const part5 = (he_cua === "Cửa xếp xích" && mau_noi_la === "Nhôm")
        ? cot_bs_4 * ((chieu_cao <= 480)
            ? tong_so_canh * so_luong
            : 2 * tong_so_canh * so_luong)
        : 0;

    // tổng
    return (part1 + part2 + part3 + part4 + part5) / khoi_luong;
}

function updateUnitPrice() {
    const beforeVatEl = document.getElementById('don_gia_truoc_thue');
    const vatEl = document.getElementById('field6');
    const priceWithVatEl = document.getElementById('don_gia_niem_yet_kl');
    const thanhTienEl = document.getElementById('thanh_tien');

    const matched = findUnitPrice();
    if (!matched || matched.don_gia_niem_yet_kl == null) {
        beforeVatEl.value = '';
        priceWithVatEl.value = 'Không tìm thấy giá';
        thanhTienEl.value = '';
        return;
    }

    // build item giống demo trước, nhưng thêm cả các cot_bs_i, don_gia_niem_yet_npp, phan_tram_tang_rem, ray_lua_khac_chuan, mau_rem, mau_noi_la, so_luong, khoi_luong
    const item = {
        ma_san_pham: matched.ma_san_pham,
        nhom_san_pham: document.getElementById('field1')?.value,
        he_cua: document.getElementById('field3')?.value,
        tong_so_canh: parseInt(document.getElementById('tong_so_canh')?.value, 10) || 0,
        so_canh_di_dong: parseInt(document.getElementById('so_canh_di_dong')?.value, 10) || 0,
        so_khung_dung: parseInt(document.getElementById('so_khung_dung')?.value, 10) || 0,
        chieu_rong: parseFloat(document.getElementById('chieu_rong')?.value) || 0,
        chieu_cao: parseFloat(document.getElementById('chieu_cao')?.value) || 0,
        dien_tich: parseFloat(document.getElementById('dien_tich')?.value) || 0,
        so_luong: parseInt(document.getElementById('so_luong')?.value, 10) || 1,
        khoi_luong: parseFloat(document.getElementById('khoi_luong')?.value) || 1,
        // những cột cot_bs_i và các field khác bạn đã sinh

        cot_bs_1: parseFloat(document.getElementById('cot_bs_1')?.value) || 0,
        cot_bs_2: parseFloat(document.getElementById('cot_bs_2')?.value) || 0,
        cot_bs_3: parseFloat(document.getElementById('cot_bs_3')?.value) || 0,
        cot_bs_4: parseFloat(document.getElementById('cot_bs_4')?.value) || 0,
        cot_bs_5: parseFloat(document.getElementById('cot_bs_5')?.value) || 0,
        don_gia_niem_yet_npp: matched.don_gia_niem_yet_npp,
        phan_tram_tang_rem: parseFloat(
            document.getElementById('phan_tram_tang_rem')?.value
        ) || 0,
        ray_lua_khac_chuan: parseFloat(document.getElementById('ray_lua_khac_chuan')?.value) || 0,
        mau_rem: document.getElementById('mau_rem')?.value,
        mau_noi_la: document.getElementById('mau_noi_la')?.value
    };

    // 1) đơn giá gốc
    let price = matched.don_gia_niem_yet_kl;

    // 2) nhân extraFactor
    const f = computeExtraFactor(item);
    price *= (1 + f);

    // 3) cộng thêm additionalCharge
    const add = computeAdditionalCharge(item);
    price += add;

    // hiển thị
    beforeVatEl.value = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    const vatRate = parseFloat(vatEl.value) || 0;
    const priceAfterVat = price * (1 + vatRate / 100);
    priceWithVatEl.value = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(priceAfterVat);
    const tl = parseFloat(document.getElementById('khoi_luong')?.value) || 1;
    thanhTienEl.value = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(priceAfterVat * tl);
}

async function loadProductCatalog() {
    const cacheKey = 'cachedProducts';
    const cacheTimeKey = 'cachedProductsTime';
    const cacheTimeLimit = 24 * 60 * 60 * 1000; // 24 giờ

    const now = Date.now();
    const cachedTime = parseInt(localStorage.getItem(cacheTimeKey), 10);
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData && cachedTime && now - cachedTime < cacheTimeLimit) {
        products = JSON.parse(cachedData);
        initField1();
        return;
    }

    try {
        const res = await fetch(`${webAppBaseURL}?mode=getDanhMucSanPham&t=${now}`);
        const data = await res.json();
        products = data;
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(cacheTimeKey, now.toString());
        initField1();
    } catch (err) {
        console.error('Lỗi load danh mục sản phẩm:', err);
        document.getElementById('field1').innerHTML = '<option value="">-- Lỗi load --</option>';
    }
}


function initField1() {
    const f1 = document.getElementById('field1');
    f1.innerHTML = '<option value="">-- Chọn nhóm --</option>';
    const groups = [...new Set(products.map(p => p.nhom_san_pham))];
    groups.sort().forEach(g => f1.add(new Option(g, g)));
    f1.disabled = false;
}

let currentProduct = null;

function onDropdownChange(e) {
    const sel1 = field('field1').value;
    const sel2 = field('field2').value;
    const sel3 = field('field3').value;
    const sel4 = field('field4').value;

    const clear = id => {
        const s = field(id);
        s.innerHTML = '<option value="">-- Chọn --</option>';
        s.disabled = true;
    };

    const fill = (id, items) => {
        const s = field(id);
        s.innerHTML = '<option value="">-- Chọn --</option>';
        items.forEach(v => s.add(new Option(v, v)));
        s.disabled = false;
    };

    function field(id) {
        return document.getElementById(id);
    }

    // Khi user chọn field1,2,3
    if (e.target.id === 'field1') {
        clear('field2'); clear('field3'); clear('field4'); field('field5').value = '';
        if (!sel1) return;
        const models = products.filter(p => p.nhom_san_pham === sel1).map(p => p.mau_cua);
        fill('field2', [...new Set(models)].sort());
    }

    if (e.target.id === 'field2') {
        clear('field3'); clear('field4'); field('field5').value = '';;
        if (!sel2) return;
        const systems = products.filter(p => p.nhom_san_pham === sel1 && p.mau_cua === sel2).map(p => p.he_cua);
        fill('field3', [...new Set(systems)].sort());
    }

    if (e.target.id === 'field3') {
        clear('field4'); field('field5').value = '';
        if (!sel3) return;
        const names = products.filter(p => p.nhom_san_pham === sel1 && p.mau_cua === sel2 && p.he_cua === sel3).map(p => p.ten_san_pham);
        fill('field4', [...new Set(names)].sort());
    }

    // Khi chọn sản phẩm cuối cùng
    if (e.target.id === 'field4') {
        if (!sel4) {
            field('field5').value = '';
            field('field6').value = '';
            field('cot_bs_1').value = '';
            field('cot_bs_2').value = '';
            field('cot_bs_3').value = '';
            field('cot_bs_4').value = '';
            field('cot_bs_5').value = '';
            return;
        }

        const found = products.find(p =>
            p.nhom_san_pham === sel1 &&
            p.mau_cua === sel2 &&
            p.he_cua === sel3 &&
            p.ten_san_pham === sel4
        );

        field('field5').value = found ? found.ma_san_pham : 'Không tìm thấy';
        field('field6').value = found ? found.hinh_anh_san_pham : 'Không tìm thấy';
        field('cot_bs_1').value = found ? found.cot_bs_1 : 'Không tìm thấy';
        field('cot_bs_2').value = found ? found.cot_bs_2 : 'Không tìm thấy';
        field('cot_bs_3').value = found ? found.cot_bs_3 : 'Không tìm thấy';
        field('cot_bs_4').value = found ? found.cot_bs_4 : 'Không tìm thấy';
        field('cot_bs_5').value = found ? found.cot_bs_5 : 'Không tìm thấy';

        document.querySelectorAll('.dynamic-field').forEach(el => el.remove());

        if (found) {
            currentProduct = found;
            const container = document.getElementById('product-selector');
            const ignoredFields = ['ma_san_pham', 'hinh_anh_san_pham', 'ma_san_pham_cau_tao', 'nhom_san_pham', 'mau_cua', 'he_cua', 'ten_san_pham', 'labels', '_labels', 'cot_bs_1', 'cot_bs_2', 'cot_bs_3', 'cot_bs_4', 'cot_bs_5'];

            Object.entries(found).forEach(([key, value]) => {
                if (ignoredFields.includes(key) || value === 'Hide' || value === '') return;
                const label = document.createElement('label');
                label.classList.add('dynamic-field');
                const displayName = found._labels?.[key] || key.replace(/_/g, ' ');
                label.textContent = displayName;

                if (value === 'Show') {
                    const skipDynamic = ['chieu_rong', 'chieu_cao', 'so_luong'];
                    if (skipDynamic.includes(key)) return;
                    const input = document.createElement('input');
                    input.type = 'number';
                    input.placeholder = `Nhập ${displayName}`;
                    input.classList.add('dynamic-field');
                    input.id = key;

                    // Gắn kiểm tra nhập liệu cũ
                    input.addEventListener('input', handler);
                    label.appendChild(document.createElement('br'));
                    label.appendChild(input);
                } else {
                    const select = document.createElement('select');
                    select.classList.add('dynamic-field');
                    select.id = key;
                    select.innerHTML = '<option value="">-- Chọn --</option>';
                    (typeof value === 'string' ? value : '').split(',').map(v => v.trim()).forEach(opt => {
                        if (opt) select.add(new Option(opt, opt));
                    });
                    label.appendChild(document.createElement('br'));
                    label.appendChild(select);
                }
                container.appendChild(label);
            });

            // Hàm xử lý chung cho các input dynamic và cố định
            function handler(e) {
                const el = e.target;
                const id = el.id;
                const prev = el.getAttribute('data-prev') || '';

                // Nếu là "số cánh di động", ép giá trị <= tổng
                if (id === 'so_canh_di_dong') {
                    const total = parseInt(document.getElementById('tong_so_canh').value, 10) || 0;
                    el.min = 0;
                    el.max = total;
                    if (+el.value > total) {
                        el.value = prev;
                        return;
                    }
                }

                // Nếu là "số cánh di động", ép giá trị <= tổng
                if (id === 'so_canh_luoi') {
                    const total = parseInt(document.getElementById('tong_so_canh').value, 10) || 0;
                    el.min = 0;
                    el.max = total;
                    if (+el.value > total) {
                        el.value = prev;
                        return;
                    }
                }

                // Nếu là "số cánh di động", ép giá trị <= tổng
                if (id === 'so_canh_rem') {
                    const total = parseInt(document.getElementById('tong_so_canh').value, 10) || 0;
                    el.min = 0;
                    el.max = total;
                    if (+el.value > total) {
                        el.value = prev;
                        return;
                    }
                }

                // Nếu là "số cánh di động", ép giá trị <= tổng
                if (id === 'so_canh_ben_trai') {
                    const total = parseInt(document.getElementById('tong_so_canh').value, 10) || 0;
                    el.min = 0;
                    el.max = total;
                    if (+el.value > total) {
                        el.value = prev;
                        return;
                    }
                }

                // Nếu là "số cánh di động", ép giá trị <= tổng
                if (id === 'so_canh_ben_phai') {
                    const total = parseInt(document.getElementById('tong_so_canh').value, 10) || 0;
                    el.min = 0;
                    el.max = total;
                    if (+el.value > total) {
                        el.value = prev;
                        return;
                    }
                }

                // Ràng buộc nghiệp vụ chung
                const isValid = validateLogicConstraints();
                if (!isValid) {
                    // vẫn giữ nguyên value mà user gõ để họ sửa
                    return;
                }
                // reset các thông báo lỗi (validateLogicConstraints đã clearError cho từng field)
                // và tiếp tục tính toán
                el.setAttribute('data-prev', el.value);
                calculateExtraFields(currentProduct);
            }

            // Gắn sự kiện handler vào các input cần thiết
            ['chieu_rong', 'chieu_cao', 'so_luong', 'tong_so_canh', 'so_canh_luoi', 'so_canh_rem', 'so_canh_ben_trai', 'so_canh_ben_phai', 'so_canh_di_dong']
                .forEach(id => document.getElementById(id)?.addEventListener('input', handler));

            // Tính toán lần đầu
            calculateExtraFields(currentProduct);
        }
    }
}


function addComputedFields(_, found) {
    const container = document.getElementById('product-calculated');
    container.querySelectorAll('.dynamic-field').forEach(el => el.remove());

    const createField = (labelText, id, readonly = true) => {
        const label = document.createElement('label');
        label.classList.add('dynamic-field');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.classList.add('dynamic-field');
        input.id = id;
        input.type = 'text';
        if (readonly) input.readOnly = true;
        label.appendChild(document.createElement('br'));
        label.appendChild(input);
        container.appendChild(label);
    };

    document.getElementById('so_luong').value = 1;

    document.querySelectorAll('.dynamic-field input, .dynamic-field select').forEach(el => {
        el.addEventListener('input', () => calculateExtraFields(found));
    });

    calculateExtraFields(found);
}


function calculateExtraFields(product) {
    const val = id => parseFloat(document.getElementById(id)?.value) || 0;
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    const chieuRong = val('chieu_rong');
    const chieuCao = val('chieu_cao');
    const soLuong = val('so_luong');
    const heCua = product.he_cua;
    const mspCauTao = product.ma_san_pham_cau_tao;
    const tongSoCanh = val('tong_so_canh');
    const dienTich = chieuRong * chieuCao / 1000000;
    set('dien_tich', dienTich.toFixed(3));

    let dvt = 'm2';
    if (heCua === 'Cửa xếp lá') {
        dvt = dienTich <= 1.2 ? 'bộ' : 'm2';
    } else if (
        heCua === 'Cửa xếp xích' &&
        mspCauTao === 'XX23.M.6005' &&
        tongSoCanh === 1
    ) {
        dvt = dienTich <= 1.6 ? 'bộ' : 'm2';
    } else if (
        heCua === 'Cửa xếp xích' &&
        mspCauTao === 'XX23.M.6005' &&
        tongSoCanh > 1
    ) {
        dvt = dienTich <= 2.0 ? 'bộ' : 'm2';
    } else if (
        heCua === 'Cửa xếp xích' &&
        mspCauTao === 'XX23.H.6005' &&
        tongSoCanh === 1
    ) {
        dvt = dienTich <= 1.6 ? 'bộ' : 'm2';
    } else if (
        heCua === 'Cửa xếp xích' &&
        mspCauTao === 'XX23.H.6005' &&
        tongSoCanh > 1
    ) {
        dvt = dienTich <= 2.5 ? 'bộ' : 'm2';
    } else {
        dvt = dienTich < 1 ? 'bộ' : 'm2';
    }
    set('don_vi_tinh', dvt);

    let khoiLuong = soLuong;
    if (dvt === 'm') khoiLuong = chieuCao / 1000 * soLuong;
    else if (dvt === 'm2') khoiLuong = chieuRong * chieuCao / 1000000 * soLuong;
    set('khoi_luong', khoiLuong.toFixed(3));

    let ktc = '';
    const inList = (v, arr) => arr.includes(v);
    if (
        inList(mspCauTao, ["CK19.D.TK", "CK19.D.NK", "CC19.D.TK", "CC19.D.NK"]) ||
        (inList(mspCauTao, ["CC19.N.TK", "CC19.N.NK"]) && tongSoCanh === 1)
    ) {
        ktc = dienTich <= 0.5 ? "S1" : (dienTich < 1 ? "S2" : "S3");
    } else if (
        inList(mspCauTao, ["CC19.N.TK", "CC19.N.NK"]) && tongSoCanh === 2
    ) {
        ktc = dienTich < 1 ? "S2" : "S3";
    } else if (
        inList(heCua, ["Cửa xếp hệ 23", "Cửa xếp hệ 26", "Cửa xếp hệ 40"])
    ) {
        ktc = dienTich <= 0.5 ? "S1" : (dienTich < 1 ? "S2" : "S3");
    } else if (
        inList(mspCauTao, ["PI14.L.EE", "PI14.L.EI"]) && [1, 2].includes(tongSoCanh)
    ) {
        ktc = dienTich < 1 ? "LE1" : (dienTich < 1.6 ? "LE2" : "LE3");
    } else if (
        inList(mspCauTao, ["PI14.L.UU", "PI14.L.UI"]) && [1, 2].includes(tongSoCanh)
    ) {
        ktc = dienTich <= 0.5 ? "LU1" : (dienTich < 1 ? "LU2" : "LU3");
    } else if (
        inList(mspCauTao, ["PI14.M.S12", "PI14.M.S25", "PI14.M.S38", "PI14.M.S50", "PI14.M.S76"]) &&
        [1, 2].includes(tongSoCanh)
    ) {
        ktc = dienTich < 1 ? "MS1" : "MS2";
    } else if (
        inList(mspCauTao, ["PI14.M.D12", "PI14.M.D25", "PI14.M.D38", "PI14.M.D50", "PI14.M.D76"]) &&
        [1, 2].includes(tongSoCanh)
    ) {
        ktc = "MD1";
    } else if (mspCauTao === "PI14.V.0045") {
        ktc = dienTich <= 0.5 ? "VC1" : (dienTich < 1 ? "VC2" : "VC3");
    } else if (mspCauTao === "XX23.M.6005" && tongSoCanh === 1) {
        if (dienTich <= 1.6 && chieuRong <= 800) ktc = "MM2";
        else if (dienTich <= 2.5) ktc = "MM3";
        else ktc = "MM4";
    } else if (mspCauTao === "XX23.M.6005" && tongSoCanh > 1) {
        if (dienTich > 4.5 && chieuRong / tongSoCanh >= 1000) ktc = "MG5";
        else if (dienTich > 3.5 && chieuRong / tongSoCanh >= 850) ktc = "MG4";
        else if (
            (dienTich > 2.0 && chieuRong > 1300) ||
            (dienTich > 3.5 && chieuRong / tongSoCanh < 850) ||
            (dienTich > 4.5 && chieuRong / tongSoCanh < 1000)
        ) {
            ktc = "MG3";
        } else if (dienTich > 2.0 && chieuRong <= 1300) {
            ktc = "MG2";
        } else {
            ktc = "MG1";
        }
    } else if (mspCauTao === "XX23.H.6005" && tongSoCanh === 1) {
        if (dienTich <= 1.6 && chieuRong <= 800) ktc = "HM2";
        else if (dienTich <= 3.5) ktc = "HM3";
        else ktc = "HM4";
    } else if (mspCauTao === "XX23.H.6005" && tongSoCanh > 1) {
        if (dienTich > 6.0 && chieuRong / tongSoCanh >= 1250) ktc = "HG6";
        else if (dienTich > 4.5 && chieuRong / tongSoCanh >= 1000) ktc = "HG5";
        else if (dienTich > 3.5 && chieuRong / tongSoCanh >= 950) ktc = "HG4";
        else if (
            (dienTich > 6.0 && chieuRong / tongSoCanh < 1250) ||
            (dienTich > 4.5 && chieuRong / tongSoCanh < 1000) ||
            (dienTich > 3.5 && chieuRong / tongSoCanh < 950) ||
            (dienTich > 2.5 && chieuRong > 1400)
        ) {
            ktc = "HG3";
        } else if (dienTich > 2.5 && chieuRong <= 1400) {
            ktc = "HG2";
        } else {
            ktc = "HG1";
        }
    } else if (mspCauTao === "XL23.P.0045") {
        if (dienTich <= 1.2) ktc = "XL1";
        else if (dienTich <= 2) ktc = "XL2";
        else ktc = "XL3";
    }
    set('khoang_tieu_chuan', ktc);

    updateUnitPrice(); // Thêm dòng này để cập nhật giá
}

document.addEventListener('DOMContentLoaded', () => {
    // 1) Gắn listener cho 3 ô nhập liệu cố định
    ['chieu_rong', 'chieu_cao', 'so_luong'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                if (currentProduct) {
                    calculateExtraFields(currentProduct);
                    updateUnitPrice();
                }
            });
        }
    });

    // 2) Gắn change listener cho 4 dropdown
    ['field1', 'field2', 'field3', 'field4'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', onDropdownChange);
    });

    // 3) Gắn input listener cho tất cả các field dynamic 
    //    (bao gồm so_canh_luoi, so_canh_rem, so_canh_ben_trai, so_canh_ben_phai, so_canh_di_dong)
    document.querySelectorAll('.dynamic-field input, .dynamic-field select').forEach(el => {
        el.addEventListener('input', () => {
            // 3.1 validate logic constraints
            const ok = validateLogicConstraints();
            // 3.2 nếu valid thì tính tiếp
            if (ok && currentProduct) {
                calculateExtraFields(currentProduct);
                updateUnitPrice();
            }
        });
    });

    // 4) Load dữ liệu catalog + price list
    loadProductCatalog();
    loadPriceList();
});



function validateLogicConstraints() {
    const val = id => {
        const el = document.getElementById(id);
        return parseInt(el?.value) || 0;
    };

    const setError = (id, msg) => {
        const el = document.getElementById(id);
        if (!el) return; // Thêm kiểm tra null

        el.classList.add('error');

        let err = el.parentNode.querySelector('.error-msg');
        if (!err) {
            err = document.createElement('span');
            err.className = 'error-msg';
            el.parentNode.appendChild(err);
        }
        err.textContent = msg;
    };

    const clearError = id => {
        const el = document.getElementById(id);
        if (!el) return; // Thêm kiểm tra null

        el.classList.remove('error');
        const err = el.parentNode.querySelector('.error-msg');
        if (err) err.remove();
    };

    const tong = val('tong_so_canh');
    const luoi = val('so_canh_luoi');
    const rem = val('so_canh_rem');
    const trai = val('so_canh_ben_trai');
    const phai = val('so_canh_ben_phai');
    const didong = val('so_canh_di_dong');

    let valid = true;

    // 1. số cánh lưới < tổng
    if (luoi > tong) {
        setError('so_canh_luoi', 'Phải nhỏ hơn hoặc bằng tổng số cánh');
        valid = false;
    } else {
        clearError('so_canh_luoi');
    }

    // 2. lưới + rèm = tổng (chỉ kiểm tra nếu cả hai trường tồn tại)
    if (document.getElementById('so_canh_luoi') && document.getElementById('so_canh_rem')) {
        if (luoi + rem !== tong) {
            setError('so_canh_rem', 'Lưới + Rèm phải bằng tổng số cánh');
            setError('so_canh_luoi', '');
            valid = false;
        } else {
            clearError('so_canh_rem');
        }
    }

    // 3. trái + phải = tổng (nếu nhập và cả hai trường tồn tại)
    if (document.getElementById('so_canh_ben_trai') && document.getElementById('so_canh_ben_phai')) {
        if (trai + phai > 0 && trai + phai !== tong) {
            setError('so_canh_ben_trai', 'Trái + Phải phải bằng tổng số cánh');
            setError('so_canh_ben_phai', '');
            valid = false;
        } else {
            clearError('so_canh_ben_trai');
            clearError('so_canh_ben_phai');
        }
    }

    // 4. di động ≤ tổng (chỉ kiểm tra nếu trường tồn tại)
    if (document.getElementById('so_canh_di_dong')) {
        if (didong > tong) {
            setError('so_canh_di_dong', 'Phải ≤ tổng số cánh');
            valid = false;
        } else {
            clearError('so_canh_di_dong');
        }
    }

    return valid;
}