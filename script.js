// ----------- START: Firebase Config -----------
const firebaseConfig = {
   apiKey: "AIzaSyBP8ZPu2zEbRcLh_9SIxjn4WQNbA0xDgoY",
        authDomain: "bdf-tournament.firebaseapp.com",
        projectId: "bdf-tournament",
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
// ----------- END: Firebase Config -----------

let currentUser = null;
let userData = {};

// --- Apply Dark Mode on Initial Load ---
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
}

// ----------- START: Main Auth Observer -----------
auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
        const userRef = db.collection('users').doc(user.uid);
        userRef.onSnapshot(doc => {
            if (doc.exists) {
                userData = { id: doc.id, ...doc.data() };
                updateUIForLoggedInUser(userData);
            } else {
                const newUser = { uid: user.uid, username: user.displayName || "New User", email: user.email, balance: 0, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
                userRef.set(newUser).then(() => userData = newUser);
            }
        }, error => console.error("Error fetching user data:", error));
    } else {
        userData = {};
        updateUIForLoggedOutUser();
    }
    loadPageSpecificData();
});
// ----------- END: Main Auth Observer -----------

function updateUIForLoggedInUser(data) {
    document.querySelectorAll('.username').forEach(el => el.textContent = data.username);
    document.querySelectorAll('.gmail').forEach(el => el.textContent = data.email);
    document.querySelectorAll('.current-balance').forEach(el => el.textContent = `৳ ${(data.balance || 0).toFixed(2)}`);
    document.querySelectorAll('.logged-in-view').forEach(el => el.style.display = 'block');
    document.querySelectorAll('.logged-out-view').forEach(el => el.style.display = 'none');
}

function updateUIForLoggedOutUser() {
    document.querySelectorAll('.logged-in-view').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.logged-out-view').forEach(el => el.style.display = 'block');
    document.querySelectorAll('.username, .gmail').forEach(el => el.textContent = '...');
    document.querySelectorAll('.current-balance').forEach(el => el.textContent = '৳ 0.00');
}

function loadPageSpecificData() {
    const path = window.location.pathname.split('/').pop();
    if (path === 'index.html' || path === '') loadHomepageData();
    else if (path === 'tournaments.html') loadTournamentsPage();
    else if (path === 'custom-room.html') loadCustomRoomPage();
    else if (path === 'transactions.html') loadTransactionsPage();
    else if (path === 'profile.html') loadProfilePage();
}

function loadHomepageData() {
    db.collection('settings').doc('banner').get().then(doc => { if (doc.exists) { const banner = doc.data(); const bannerLink = document.getElementById('banner-link'); if (bannerLink) { bannerLink.href = banner.clickUrl || '#'; document.getElementById('banner-image').src = banner.imageUrl || ''; } } });
    db.collection('tournaments').where('registrationEnabled', '==', true).orderBy('startDate', 'desc').limit(5).get().then(snapshot => {
        const list = document.getElementById('tournament-list-homepage');
        if (!list) return; list.innerHTML = '';
        if (snapshot.empty) { list.innerHTML = '<p>বর্তমানে কোনো টুর্নামেন্ট চালু নেই।</p>'; return; }
        snapshot.forEach(doc => {
            const t = doc.data();
            list.innerHTML += `<div class="tournament-card"><h4>${t.title}</h4><p><strong>ধরন:</strong> ${t.type}</p><p><strong>শুরু:</strong> ${new Date(t.startDate).toLocaleString()}</p><p><strong>এন্ট্রি ফি:</strong> ৳ ${t.entryFee}</p><button class="btn-join" onclick="window.location.href='tournaments.html'">View Details</button></div>`;
        });
    });
}

function loadTournamentsPage() {
    db.collection('tournaments').orderBy('startDate', 'desc').get().then(snapshot => {
        const list = document.getElementById('tournament-list-full');
        if (!list) return; list.innerHTML = '';
        if (snapshot.empty) { list.innerHTML = '<p>বর্তমানে কোনো টুর্নামেন্ট চালু নেই।</p>'; return; }
        snapshot.forEach(doc => {
            const t = doc.data(); const tournamentData = JSON.stringify(t).replace(/"/g, '&quot;');
            list.innerHTML += `<div class="tournament-card" id="t-card-${doc.id}"><h4>${t.title}</h4><p><strong>ধরন:</strong> ${t.type}</p><p><strong>শুরু:</strong> ${new Date(t.startDate).toLocaleString()}</p><p><strong>এন্ট্রি ফি:</strong> ৳ ${t.entryFee}</p><p><strong>প্লেয়ার লিমিট:</strong> ${t.playerLimit}</p><p>${t.description || ''}</p><button class="btn-join" onclick='openJoinModal("${doc.id}", ${tournamentData})' ${t.registrationEnabled ? '' : 'disabled'}>${t.registrationEnabled ? 'Join Now' : 'Closed'}</button></div>`;
        });
        checkIfUserAlreadyJoined();
    });
}

function loadCustomRoomPage() {
    db.collection('settings').doc('texts').get().then(doc => { if (doc.exists) document.getElementById('custom-terms-label').textContent = doc.data().customText || "শর্তাবলী মেনে নিলাম।"; });
}

// এই পুরনো ফাংশনটি মুছে নতুনটি বসান
function loadTransactionsPage() {
    if (!currentUser) {
        document.getElementById('transaction-list').innerHTML = "<p>আপনার লেনদেন দেখতে লগইন করুন।</p>";
        return;
    }
    db.collection('transactions').where('uid', '==', currentUser.uid).orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        const list = document.getElementById('transaction-list');
        if (!list) return;
        list.innerHTML = '';
        if (snapshot.empty) {
            list.innerHTML = '<p>আপনার কোনো লেনদেনের হিস্টোরি নেই।</p>';
            return;
        }
        snapshot.forEach(doc => {
            const tx = doc.data();
            const amountClass = tx.amount > 0 ? 'positive' : 'negative';
            const date = tx.createdAt ? new Date(tx.createdAt.seconds * 1000).toLocaleString() : 'N/A';
            
            // স্ট্যাটাসের জন্য সুন্দর ডিজাইন যোগ করা হয়েছে
            const statusHtml = `<span class="status status-${tx.status}">${tx.status}</span>`;

            list.innerHTML += `
                <div class="transaction-item">
                    <div class="transaction-details">
                        <p class="type">${tx.type} (${statusHtml})</p>
                        <p class="description">${tx.description || ''}</p>
                        <p class="date">${date}</p>
                    </div>
                    <div class="transaction-amount ${amountClass}">
                        ${tx.amount > 0 ? '+' : ''}৳ ${tx.amount.toFixed(2)}
                    </div>
                </div>`;
        });
    });
}

function loadProfilePage() {
    db.collection('settings').doc('paymentMethods').get().then(doc => {
        if (doc.exists) {
            const methods = doc.data();
            const topupSelect = document.getElementById('topup-medium'), withdrawSelect = document.getElementById('withdraw-medium');
            if (topupSelect) { topupSelect.innerHTML = '<option value="">মাধ্যম নির্বাচন করুন</option>'; if (methods.topup) methods.topup.forEach(m => topupSelect.add(new Option(`${m.name} (${m.number}) - ${m.type}`, m.name))); }
            if (withdrawSelect) { withdrawSelect.innerHTML = '<option value="">মাধ্যম নির্বাচন করুন</option>'; if (methods.withdraw) methods.withdraw.forEach(m => withdrawSelect.add(new Option(m.name, m.name))); }
        }
    });
    db.collection('settings').doc('texts').get().then(doc => {
        if (doc.exists) {
            const texts = doc.data();
            document.getElementById('topup-terms-label').textContent = texts.topupText || "শর্তাবলী মেনে নিলাম।";
            document.getElementById('withdraw-terms-label').textContent = texts.withdrawText || "শর্তাবলী মেনে নিলাম।";
            document.getElementById('contact-text-body').textContent = texts.contactText || "যোগাযোগের তথ্য শীঘ্রই যোগ করা হবে।";
            document.getElementById('terms-text-body').textContent = `${texts.joinText || ''} \n\n ${texts.customText || ''} \n\n ${texts.topupText || ''} \n\n ${texts.withdrawText || ''}`;
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.login-btn').forEach(btn => btn.onclick = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()));
    document.querySelectorAll('.logout-btn').forEach(btn => btn.onclick = () => auth.signOut());
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.checked = document.body.classList.contains('dark-mode');
        darkModeToggle.addEventListener('change', () => {
            document.body.classList.toggle('dark-mode');
            localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
        });
    }
    document.getElementById('topupForm')?.addEventListener('submit', handleRequestFormSubmit);
    document.getElementById('withdrawForm')?.addEventListener('submit', handleRequestFormSubmit);
    document.getElementById('customRoomForm')?.addEventListener('submit', handleRequestFormSubmit);
    document.getElementById('joinTournamentForm')?.addEventListener('submit', handleTournamentJoin);
});

// এই পুরনো ফাংশনটি মুছে নতুনটি বসান
async function handleRequestFormSubmit(e) {
    e.preventDefault();
    if (!currentUser) return alert("অনুগ্রহ করে প্রথমে লগইন করুন!");

    const formId = e.target.id;
    let collectionName, type, data, successMsg, balanceCheck = false, amount;

    // Determine form type and collect data
    if (formId === 'topupForm') {
        collectionName = 'topup_requests'; type = 'Top Up'; amount = parseFloat(e.target.amount.value);
        data = { medium: e.target.medium.value, userNumber: e.target.userNumber.value, amount, trxId: e.target.trxId.value };
        successMsg = "Top Up অনুরোধটি সফলভাবে জমা হয়েছে!";
    } else if (formId === 'withdrawForm') {
        collectionName = 'withdraw_requests'; type = 'Withdraw'; amount = parseFloat(e.target.amount.value);
        data = { medium: e.target.medium.value, userNumber: e.target.userNumber.value, amount };
        successMsg = "Withdraw অনুরোধটি সফলভাবে জমা হয়েছে!"; balanceCheck = true;
    } else if (formId === 'customRoomForm') {
        collectionName = 'custom_room_requests'; type = 'Custom Room'; amount = parseFloat(e.target.entryAmount.value);
        data = { mode: e.target.mode.value, howToPlay: e.target.howToPlay.value, dateTime: e.target.dateTime.value, entryAmount: amount };
        successMsg = "Custom Room তৈরির অনুরোধটি সফলভাবে জমা হয়েছে!"; balanceCheck = true;
    }

    // Balance check before proceeding
    if (balanceCheck && userData.balance < amount) {
        return alert("দুঃখিত, আপনার পর্যাপ্ত ব্যালেন্স নেই!");
    }

    const requestData = { uid: currentUser.uid, ...data, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp() };

    try {
        // Create the main request document
        const docRef = await db.collection(collectionName).add(requestData);

        // Deduct balance if necessary
        if (balanceCheck) {
            await db.collection('users').doc(currentUser.uid).update({ balance: firebase.firestore.FieldValue.increment(-amount) });
        }

        // --- START: Corrected Transaction Logic ---
        // Create a transaction record with the SAME ID as the request
        await db.collection('transactions').doc(docRef.id).set({
            uid: currentUser.uid,
            type: type,
            description: `Request for ${type}`,
            amount: balanceCheck ? -amount : amount, // For top-up, amount is positive but pending
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        // --- END: Corrected Transaction Logic ---

        alert(successMsg);
        // Safely find the modal to close
        const modalToClose = e.target.closest('.modal');
        if (modalToClose) {
            closeModal(modalToClose.id);
        }
        e.target.reset();

    } catch (error) {
        console.error("Error submitting request:", error);
        alert("একটি ত্রুটি ঘটেছে: " + error.message);
    }
}

async function handleTournamentJoin(e) {
    e.preventDefault(); if (!currentUser) return alert("Session expired. Please log in again.");
    const tournamentId = document.getElementById('join_tournament_id').value;
    const entryFee = parseFloat(document.getElementById('join_entry_fee').value);
    const tournamentName = document.getElementById('join_tournament_name').textContent;
    const tournamentType = document.getElementById('join_tournament_type').textContent;
    if (userData.balance < entryFee) { alert("দুঃখিত, আপনার পর্যাপ্ত ব্যালেন্স নেই!"); window.location.href = 'profile.html'; return; }
    const players = []; let playerCount = 1;
    if (tournamentType === 'Duo') playerCount = 2; if (tournamentType === 'Squad') playerCount = 4;
    for (let i = 1; i <= playerCount; i++) { players.push({ uid: document.getElementById(`player_uid_${i}`).value, name: document.getElementById(`player_name_${i}`).value }); }
    const joinData = { uid: currentUser.uid, tournamentId, tournamentName, players, entryFee, joinedAt: firebase.firestore.FieldValue.serverTimestamp() };
    try {
        await db.collection('tournament_joins').add(joinData);
        await db.collection('users').doc(currentUser.uid).update({ balance: firebase.firestore.FieldValue.increment(-entryFee) });
        await db.collection('transactions').add({ uid: currentUser.uid, type: 'Tournament Join', description: `Joined '${tournamentName}'`, amount: -entryFee, status: 'completed', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        alert("আপনি সফলভাবে টুর্নামেন্টে অংশগ্রহণ করেছেন!"); closeModal('joinTournamentModal');
        const button = document.querySelector(`#t-card-${tournamentId} .btn-join`);
        if (button) { button.textContent = 'অংশগ্রহণ করেছেন'; button.disabled = true; }
    } catch (error) { alert("একটি ত্রুটি ঘটেছে: " + error.message); }
}

function openJoinModal(tournamentId, tournamentData) {
    if (!currentUser) return alert("টুর্নামেন্টে জয়েন করতে অনুগ্রহ করে লগইন করুন।");
    document.getElementById('join_tournament_id').value = tournamentId;
    document.getElementById('join_entry_fee').value = tournamentData.entryFee;
    document.getElementById('join_tournament_name').textContent = tournamentData.title;
    document.getElementById('join_tournament_type').textContent = tournamentData.type;
    document.getElementById('join-email').value = currentUser.email;
    const container = document.getElementById('player-fields-container'); container.innerHTML = '';
    let playerCount = 1; if (tournamentData.type === 'Duo') playerCount = 2; if (tournamentData.type === 'Squad') playerCount = 4;
    for (let i = 1; i <= playerCount; i++) { container.innerHTML += `<div class="player-group"><h5>Player ${i}</h5><div class="form-group"><label>Free Fire UID ${i}</label><input type="text" id="player_uid_${i}" required></div><div class="form-group"><label>Free Fire Username ${i}</label><input type="text" id="player_name_${i}" required></div></div>`; }
    db.collection('settings').doc('texts').get().then(doc => { if (doc.exists) document.getElementById('join-terms-label').textContent = doc.data().joinText || "শর্তাবলী মেনে নিলাম।"; });
    openModal('joinTournamentModal');
}

function checkIfUserAlreadyJoined() {
    if (!currentUser) return;
    db.collection('tournament_joins').where('uid', '==', currentUser.uid).get().then(snapshot => {
        snapshot.forEach(doc => {
            const tournamentId = doc.data().tournamentId;
            const button = document.querySelector(`#t-card-${tournamentId} .btn-join`);
            if (button) { button.textContent = 'অংশগ্রহণ করেছেন'; button.disabled = true; }
        });
    });
}

function openModal(modalId) { document.getElementById(modalId)?.classList.add('show'); }
function closeModal(modalId) { document.getElementById(modalId)?.classList.remove('show'); }
window.onclick = function (event) { if (event.target.classList.contains('modal')) { event.target.classList.remove('show'); } }