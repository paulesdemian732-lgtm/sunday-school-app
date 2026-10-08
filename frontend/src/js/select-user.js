let selectedServant = null;
let isSettingNewPassword = false;

async function handleUserSelection(userName) {
    selectedServant = userName;

    const modal = document.getElementById('authModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalDesc = document.getElementById('modalDesc');
    const confirmGroup = document.getElementById('confirmPasswordGroup');
    const passwordInput = document.getElementById('modalPasswordInput');
    const confirmInput = document.getElementById('modalConfirmPasswordInput');
    const errorBox = document.getElementById('modalError');
    const submitBtn = document.getElementById('modalSubmitBtn');

    // تصفير الحقول والتنبيهات
    passwordInput.value = '';
    confirmInput.value = '';
    errorBox.style.display = 'none';
    errorBox.textContent = '';
    submitBtn.disabled = true;

    modalTitle.textContent = `مرحباً بك ${userName}`;
    modalDesc.textContent = 'جاري التحقق من الحساب...';
    modal.style.display = 'flex';

    try {
        // فحص هل الخادم مسجل في السيرفر وقاعدة البيانات
        const res = await fetch(`/api/servant-status/${encodeURIComponent(userName)}`);
        const data = await res.json();
        const hasPassword = data.hasPassword;

        if (!hasPassword) {
            // يدخل لأول مرة
            isSettingNewPassword = true;
            modalDesc.textContent = 'أنت تسجل لأول مرة، يرجى إنشاء كلمة مرور خاصة ببروفايلك:';
            confirmGroup.style.display = 'block';
            confirmInput.required = true;
            passwordInput.placeholder = 'أنشئ كلمة المرور';
            confirmInput.placeholder = 'تأكيد كلمة المرور';
            submitBtn.textContent = 'حفظ وتعيين';
        } else {
            // مسجل سابقاً
            isSettingNewPassword = false;
            modalDesc.textContent = 'أدخل كلمة المرور الخاصة بك للمتابعة:';
            confirmGroup.style.display = 'none';
            confirmInput.required = false;
            passwordInput.placeholder = 'كلمة المرور';
            submitBtn.textContent = 'دخول';
        }
    } catch (err) {
        modalDesc.textContent = 'تعذر الاتصال بالسيرفر، حاول مجدداً.';
    } finally {
        submitBtn.disabled = false;
        passwordInput.focus();
    }
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.style.display = 'none';
    selectedServant = null;
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    if (!selectedServant) return;

    const passwordInput = document.getElementById('modalPasswordInput');
    const confirmInput = document.getElementById('modalConfirmPasswordInput');
    const errorBox = document.getElementById('modalError');
    const submitBtn = document.getElementById('modalSubmitBtn');

    const enteredPassword = passwordInput.value.trim();

    if (isSettingNewPassword) {
        const enteredConfirm = confirmInput.value.trim();

        if (enteredPassword.length < 4) {
            errorBox.textContent = 'كلمة المرور يجب ألا تقل عن 4 أرقام أو حروف';
            errorBox.style.display = 'block';
            return;
        }

        if (enteredPassword !== enteredConfirm) {
            errorBox.textContent = 'كلمتا المرور غير متطابقتين';
            errorBox.style.display = 'block';
            return;
        }
    }

    submitBtn.disabled = true;
    errorBox.style.display = 'none';

    try {
        const response = await fetch('/api/servant-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: selectedServant,
                password: enteredPassword,
                isNew: isSettingNewPassword
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            sessionStorage.setItem('currentServant', selectedServant);
            window.location.href = '/servant-class/class.html';
        } else {
            errorBox.textContent = data.message || 'كلمة المرور غير صحيحة، حاول مجدداً';
            errorBox.style.display = 'block';
            passwordInput.focus();
        }
    } catch (err) {
        errorBox.textContent = 'حدث خطأ في الاتصال بالشبكة';
        errorBox.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
    }
}

function openHonorBoard() {
    window.location.href = '/honor-board/honor.html';
}

function openAllKidsStats() {
    window.location.href = '/all-kids-stats/stats.html';
}

// إغلاق النافذة المنبثقة عند الضغط في الخلفية الخارجية
window.addEventListener('click', (e) => {
    const modal = document.getElementById('authModal');
    if (e.target === modal) {
        closeAuthModal();
    }
});s