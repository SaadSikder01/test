// ==================== Firebase Config ====================
const firebaseConfig = {
    apiKey: "AIzaSyDTxzgfZ8IuPpqp4Q20cE8JZvif32pDhgc",
    authDomain: "my-class-46989.firebaseapp.com",
    projectId: "my-class-46989",
    storageBucket: "my-class-46989.firebasestorage.app",
    messagingSenderId: "716703687515",
    appId: "1:716703687515:web:b9a11736e7f58e071c307e",
    databaseURL: "https://my-class-46989-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let currentGroupId = null;
let groupAvatarBase64 = null;
let pendingImageBase64 = null;

// ==================== অথেনটিকেশন ====================
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('userInfo').innerHTML = `স্বাগতম, <strong>${user.email}</strong>`;
        loadUserGroups();
    } else {
        window.location.href = "login.html";
    }
});

// ==================== গ্রুপ তৈরি ====================
async function createGroup() {
    const name = document.getElementById('gName').value.trim();
    let gid = document.getElementById('gId').value.trim().toUpperCase();

    if (!name || !gid) return alert("গ্রুপের নাম এবং ইউনিক আইডি দিন!");

    const snap = await db.ref('groups').orderByChild('groupId').equalTo(gid).once('value');
    if (snap.exists()) return alert("এই ইউনিক আইডি ইতিমধ্যে ব্যবহৃত হয়েছে!");

    const groupId = db.ref('groups').push().key;

    await db.ref(`groups/${groupId}`).set({
        name: name,
        groupId: gid,
        admin: currentUser.uid,
        avatarUrl: groupAvatarBase64,
        createdAt: Date.now()
    });

    await db.ref(`userGroups/${currentUser.uid}/${groupId}`).set(true);

    closeModal();
    alert("✅ গ্রুপ সফলভাবে তৈরি হয়েছে!");
    groupAvatarBase64 = null;
}

// ==================== ইউজারের গ্রুপ লোড (স্মার্ট লিস্ট) ====================
function loadUserGroups() {
    const container = document.getElementById('groupList');
    db.ref(`userGroups/${currentUser.uid}`).on('value', async (snapshot) => {
        container.innerHTML = '';
        const userGroups = snapshot.val() || {};
        let groupArray = [];

        for (let groupId in userGroups) {
            const groupSnap = await db.ref(`groups/${groupId}`).once('value');
            const group = groupSnap.val();
            if (!group) continue;

            const lastMsgSnap = await db.ref(`messages/${groupId}`).limitToLast(1).once('value');
            let lastMsg = { timestamp: 0, text: "" };
            lastMsgSnap.forEach(s => lastMsg = s.val());

            groupArray.push({
                id: groupId,
                ...group,
                lastTimestamp: lastMsg.timestamp || group.createdAt || 0,
                lastText: lastMsg.text || (lastMsg.imageUrl ? "📷 ছবি" : "কোনো মেসেজ নেই")
            });
        }

        groupArray.sort((a, b) => b.lastTimestamp - a.lastTimestamp);

        groupArray.forEach(group => {
            const div = document.createElement('div');
            div.className = 'group-item';
            div.innerHTML = `
                <div class="group-avatar">${group.avatarUrl ? `<img src="${group.avatarUrl}" style="width:100%;height:100%;object-fit:cover;">` : group.name[0]}</div>
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:600;">${group.name}</div>
                    <div style="font-size:13px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${group.lastText}</div>
                </div>
            `;
            div.onclick = () => openGroup(group.id, group);
            container.appendChild(div);
        });
    });
}

// ==================== সার্চ ====================
function searchGroups() {
    const query = document.getElementById('searchBar').value.trim().toUpperCase();
    const resultsContainer = document.getElementById('searchResults');
    
    if (query.length < 2) {
        resultsContainer.innerHTML = '';
        return;
    }

    db.ref('groups').orderByChild('groupId').equalTo(query).once('value', async (snapshot) => {
        resultsContainer.innerHTML = '';
        const groups = snapshot.val() || {};
        
        if (Object.keys(groups).length === 0) {
            resultsContainer.innerHTML = `<p style="color:#888;padding:15px;">কোনো গ্রুপ পাওয়া যায়নি</p>`;
            return;
        }

        for (let groupId in groups) {
            const group = groups[groupId];
            const isMemberSnap = await db.ref(`userGroups/${currentUser.uid}/${groupId}`).once('value');
            const isMember = isMemberSnap.exists();

            const div = document.createElement('div');
            div.className = 'search-result';
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="group-avatar">${group.avatarUrl ? `<img src="${group.avatarUrl}" style="width:100%;height:100%;object-fit:cover;">` : group.name[0]}</div>
                    <div>
                        <div style="font-weight:600;">${group.name}</div>
                        <div style="color:#aaa;">${group.groupId}</div>
                    </div>
                </div>
            `;

            if (isMember) {
                div.innerHTML += `<button onclick="openGroup('${groupId}', ${JSON.stringify(group)})" style="margin-top:8px;background:#667eea;color:white;border:none;padding:8px 16px;border-radius:20px;cursor:pointer;width:100%;">গ্রুপ খুলুন</button>`;
            } else {
                div.innerHTML += `<button onclick="sendJoinRequest('${groupId}', '${group.name}')" style="margin-top:8px;background:#10b981;color:white;border:none;padding:8px 16px;border-radius:20px;cursor:pointer;width:100%;">জয়েন রিকোয়েস্ট পাঠান</button>`;
            }
            resultsContainer.appendChild(div);
        }
    });
}

// অন্যান্য ফাংশন (openGroup, sendJoinRequest, showCreateGroupModal, closeModal, startGaleneCall ইত্যাদি) আপনার আগের কোড থেকে রাখুন

function openGroup(groupId, group) {
    currentGroupId = groupId;
    document.getElementById('groupTitle').innerText = group.name;
    document.getElementById('chatArea').style.display = 'flex';
}

function showCreateGroupModal() {
    document.getElementById('createModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('createModal').style.display = 'none';
}

function startGaleneCall() {
    window.open('https://meet.myclassbd.shop', '_blank');
}

// ছবি প্রিভিউ এবং পাঠানোর ফাংশন আগের কোড থেকে রাখুন
function previewImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        groupAvatarBase64 = e.target.result;
        document.getElementById('previewAvatar').innerHTML = `<img src="${groupAvatarBase64}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    };
    reader.readAsDataURL(file);
}
