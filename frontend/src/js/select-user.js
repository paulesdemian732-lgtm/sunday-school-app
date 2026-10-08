let selectedServant = null;
let isSettingNewPassword = false;

function getServantsPasswords() {
    try {
        return JSON.parse(localStorage.getItem('sundaySchoolServantsPasswords') || '{}');
    } catch (e) {
        return {};
    }
}

function saveServantsPasswords(data) {
    localStorage.setItem('sundaySchoolServantsPasswords', JSON.stringify(data));
}

function handleUserSelection(userName) {
    selectedServant = userName;
    const passwords = getServantsPasswords();
    const hasPassword = Boolean(passwords[userName]);

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

    if (!hasPassword) {
        // يدخل لأول مرة
        isSettingNewPassword = true;
        modalTitle.textContent = `مرحباً بك ${userName}`;
        modalDesc.textContent = 'أنت تسجل لأول مرة، يرجى إنشاء كلمة مرور خاصة ببروفايلك:';
        confirmGroup.style.display = 'block';
        confirmInput.required = true;
        passwordInput.placeholder = 'أنشئ كلمة المرور';
        confirmInput.placeholder = 'تأكيد كلمة المرور';
        submitBtn.textContent = 'حفظ وتعيين';
    } else {
        // مسجل سابقاً
        isSettingNewPassword = false;
        modalTitle.textContent = `مرحباً بك ${userName}`;
        modalDesc.textContent = 'أدخل كلمة المرور الخاصة بك للمتابعة:';
        confirmGroup.style.display = 'none';
        confirmInput.required = false;
        passwordInput.placeholder = 'كلمة المرور';
        submitBtn.textContent = 'دخول';
    }

    modal.style.display = 'flex';
    passwordInput.focus();
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.style.display = 'none';
    selectedServant = null;
}

function handleAuthSubmit(e) {
    e.preventDefault();
    if (!selectedServant) return;

    const passwordInput = document.getElementById('modalPasswordInput');
    const confirmInput = document.getElementById('modalConfirmPasswordInput');
    const errorBox = document.getElementById('modalError');

    const enteredPassword = passwordInput.value.trim();
    const passwords = getServantsPasswords();

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

        // حفظ كلمة المرور لأول مرة
        passwords[selectedServant] = enteredPassword;
        saveServantsPasswords(passwords);

        // التوجيه إلى فصل الخادم بمسار مطلق
        sessionStorage.setItem('currentServant', selectedServant);
        window.location.href = '/servant-class/class.html';
    } else {
        // التحقق من كلمة المرور السابقة
        if (passwords[selectedServant] === enteredPassword) {
            sessionStorage.setItem('currentServant', selectedServant);
            window.location.href = '/servant-class/class.html';
        } else {
            errorBox.textContent = 'كلمة المرور غير صحيحة، حاول مجدداً';
            errorBox.style.display = 'block';
            passwordInput.focus();
        }
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
});