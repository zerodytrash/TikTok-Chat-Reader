// This will use the demo backend if you open index.html locally via file://, otherwise your server will be used
let backendUrl = location.protocol === 'file:' ? "https://tiktok-chat-reader.zerody.one/" :  undefined;
let connection = new TikTokIOConnection(backendUrl);

        // (A) LOAD FILE SYSTEM MODU
// Counter
let viewerCount = 0;
let likeCount = 0;
let diamondsCount = 0;
let usernames = [];
let gifter_ary = [];
let link_ary = {};

// These settings are defined by obs.html
if (!window.settings) window.settings = {};

$(document).ready(() => {
    $('#copy-table').on('click', function(){
        console.log('copy btn clicked')

        let text = document.getElementById('gifter-table').innerText, textarea = document.getElementById('hidden')
        textarea.value = text.split("	").join(',');

        console.log('copy')
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length)
        navigator.clipboard.writeText(textarea.value);
        textarea.setSelectionRange(0,0)
    })
    $('#connectButton').click(connect);
    $('#uniqueIdInput').on('keyup', function (e) {
        if (e.key === 'Enter') {
            connect();
        }
    });

    if (window.settings.username) connect();
    /***** /copy ***********/
})

/***** /copy ***********/
function connect() {
    let uniqueId = window.settings.username || $('#uniqueIdInput').val();
    if (uniqueId !== '') {

        $('#stateText').text('Connecting...');

        connection.connect(uniqueId, {
            enableExtendedGiftInfo: true
        }).then(state => {
            console.log(' -- state --')
            console.log(state)
            console.log(' -- /state --')
            //<span class="input-group-text" id="stats-viewers">Connected to roomId ${state.roomId}</span>

            $('#stateText').html(`<h4>${state.roomInfo.owner.display_id} &nbsp;&nbsp;&nbsp;&nbsp;--|.^.|--&nbsp;&nbsp;&nbsp;&nbsp; ${state.roomInfo.owner.nickname}</h4>`);

            // reset stats
            viewerCount = 0;
            likeCount = 0;
            diamondsCount = 0;
            updateRoomStats();

            let g_length = state.availableGifts.length, i, list = '', html = '';
            for(i=0;i<g_length;i++){
                list += state.availableGifts[i]
            }

        }).catch(errorMessage => {
            $('#stateText').text(errorMessage);

            // schedule next try if obs username set
            if (window.settings.username) {
                setTimeout(() => {
                    connect(window.settings.username);
                }, 30000);
            }
        })

    } else {
        alert('no username entered');
    }
}

// Prevent Cross site scripting (XSS)
function sanitize(text) {
    return text ? text.replace(/</g, '&lt;') : ''
}

function updateRoomStats() {
    $('#roomStats').html(`
    <div class="input-group mb-1">
        <span class="input-group-text" id="stats-viewers">Viewers</span>
        <input readonly value="${viewerCount.toLocaleString()}" type="text" class="form-control " placeholder="0" aria-label="Viewers" aria-describedby="stats-viewers">
        <span class="input-group-text" id="stats-likes">Likes</span>
        <input readonly value="${likeCount.toLocaleString()}" type="text" class="form-control" placeholder="0" aria-label="Likes" aria-describedby="stats-likes">
        <span class="input-group-text" id="stats-viewers">Diamonds</span>
        <input readonly value="${diamondsCount.toLocaleString()}" type="text" class="form-control" placeholder="0" aria-label="Diamonds" aria-describedby="stats-diamonds">
    </div>
    `)
    /*
    Viewers: <b>${viewerCount.toLocaleString()}</b>
    Likes: <b>${likeCount.toLocaleString()}</b>
    Earned Diamonds: <b>${diamondsCount.toLocaleString()}</b>*/
}

function generateUsernameLink(data) {
    return `<a class="usernamelink" href="https://www.tiktok.com/@${data.uniqueId}" data-bs-tooltip="${data.nickname}" target="_blank">${data.uniqueId}</a>`;
}

function isPendingStreak(data) {
    return data.giftType === 1 && !data.repeatEnd;
}

/**
 * Add a new message to the chat container
 */
function addChatItem(color, data, text, cont) {
    let container = location.href.includes('obs.html') ? $('.eventcontainer') : $(cont);
    container.append(`
    <li class="list-group-item list-group-item-action px-1 pt-2 pb-1">
        <div class="row g-1 d-table">
            <div class="col-sm-1 d-table-cell align-top">
                <img class="w-100 h-auto rounded-circle" src="${data.profilePictureUrl}">
            </div>
            <div class="col-sm-11 d-table-cell align-middle">
                <span>
                    <b>${generateUsernameLink(data)}:</b>
                    <span style="color:${color}">${sanitize(text)}</span>
                </span>
            </div>
        </div>
    </li>`);

    container.stop();
    container.animate({
        scrollTop: container[0].scrollHeight
    }, 400);
}

function addShareItem(color, data, text, cont) {
    let container = $('.sharecontainer');
    container.prepend(`<li class="list-group-item p-1">
        <div class="static">
            <img class="miniprofilepicture" src="${data.profilePictureUrl}">
            <span>
                <b>${generateUsernameLink(data)}:</b>
                <span style="color:${color}">${sanitize(text)}</span>
            </span>
        </div>
    </li>`);
}
/**
 * Add a new gift to the gift container
 */
function addGiftItem(data) {
    let container = location.href.includes('obs.html') ? $('.eventcontainer') : $('.giftcontainer');

    if (container.find('div').length > 200) {
        container.find('div').slice(0, 100).remove();
    }

    let streakId = data.userId.toString() + '_' + data.giftId;
    let isPending = isPendingStreak(data)
    let diamonds = data.diamondCount * data.repeatCount
    let diamondsLocal = (data.diamondCount * data.repeatCount).toLocaleString()
    let html = `<li class="list-group-item list-group-item-action p-1" data-streakid="${isPendingStreak(data) ? streakId : ''}">
    <div class="row g-2">
        <div class="col-1">
            <img class="w-100 h-auto rounded" src="${data.profilePictureUrl}">
        </div>
        <div class="col-11">
            <p class="fw-bold mb-1">${generateUsernameLink(data)}:</b> <span>${data.describe}</p>
            <div class="row g-1">
                <div class="col-2">
                    <img class="img-fluid" src="${data.giftPictureUrl}">
                </div>
                <div class="col-10">
                    <span>Name: <b>${data.giftName}</b> (ID:${data.giftId})<span><br>
                    <span>Repeat: <b style="${isPending ? 'color:red' : ''}">x${data.repeatCount.toLocaleString()}</b><span><br>
                    <span>Cost: <b>${diamondsLocal} Diamonds</b><span>
                </div>
            </div>
        </div>
    </div>
    </li>`;
    let existingStreakItem = container.find(`[data-streakid='${streakId}']`);

    if (existingStreakItem.length) {
        existingStreakItem.replaceWith(html);
    } else {
        container.prepend(html);
    }


    if(!isPending){
        let gifter = data.uniqueId;
        let giftertotalcontainer = $('.giftertotalcontainer')
        if(gifter in gifter_ary){
            gifter_ary[gifter].coins = parseInt(gifter_ary[gifter].coins)+parseInt(diamonds);
            $('[data-gifter="'+gifter+'"]').remove()
        } else {
            gifter_ary[gifter] = {
                username: data.nickname,
                userId: data.uniqueId,
                coins: diamonds
            }
        }
        let gifterTable = $('#gifter-table tbody')
        //let tline = gifter_ary[gifter].username+','+gifter_ary[gifter].userId+','+gifter_ary[gifter].coins+"\n";
        gifterTable.prepend(`
            <tr data-gifter="${gifter}">
                <td class="col-5 text-truncate">${gifter_ary[gifter].username}</td>
                <td class="col-5 text-truncate">${gifter_ary[gifter].userId}</td>
                <td class="col-2 text-truncate">${gifter_ary[gifter].coins.toLocaleString()}</td>
            </tr>
        `)
        let line = gifter_ary[gifter].username+','+gifter_ary[gifter].userId+','+gifter_ary[gifter].coins.toLocaleString()+"\n";
        giftertotalcontainer.prepend(`
        <li class="list-group-item list-group-item-action p-1" data-gifter="${gifter}">
            ${line}
        </li>
        `)
    }
}

function addLikeItem(color, data, text, summarize) {
        let container = $('.likecontainer');
        //let tt = sanitize(text);
        console.log(tt);
        if (container.find('div').length > 500) {
            container.find('div').slice(0, 200).remove();
        }

        //container.find('.temporary').remove();
        if(text != ''){
            container.prepend(`<li class="list-group-item list-group-item-action p-1">
                <div class=${summarize ? 'temporary' : 'static'}>
                    <img class="miniprofilepicture" src="${data.profilePictureUrl}">
                    <span>
                        <b>${generateUsernameLink(data)}:</b>
                        <span style="color:${color}">${sanitize(text)}</span>
                    </span>
                </div>
            </li>`);
        }
}

function updateTopGifters(viewers){
    let container = $('#topViewers')
    container.html('Loading Gifters...')
    if(viewers.length > 0){
        let cc = 0, i, top = '', rest = '', drop = `<li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle" data-bs-toggle="dropdown" href="#" role="button" aria-expanded="false"></a>
            <ul class="dropdown-menu" style="width:250px;">
        `, drop_end = `</ul></li>`
        for(i=0;i<viewers.length;i++){
            if(i < 2){
                top += `<li class="nav-item">
                    <a class="nav-link" aria-current="page" href="#"><img src="${viewers[i].user.profilePictureUrl}" style="max-width:50px; height:auto;"> ${viewers[i].user.uniqueId} <small>(${viewers[i].coinCount} coins)</small></a>
                </li>`
            }
            drop += `<li class="nav-item border-bottom">
                <a class="nav-link" aria-current="page" href="#"><img src="${viewers[i].user.profilePictureUrl}"> ${viewers[i].user.uniqueId} <small>(${viewers[i].coinCount} coins)</small></a>
            </li>`

            if(parseInt(viewers[i].coinCount) > 0
                && typeof viewers[i].user.username != undefined
                && viewers[i].user.username != 'undefined'
                && viewers[i].user.username != ''
                && viewers[i].user.username != null){
                let gifter = viewers[i].user.uniqueId;
                let giftertotalcontainer = $('.giftertotalcontainer')
                if(gifter in gifter_ary){
                    gifter_ary[gifter].coins = parseInt(viewers[i].coinCount);
                    $('[data-gifter="'+gifter+'"]').remove()
                } else {
                    gifter_ary[gifter] = {
                        username: viewers[i].user.nickname,
                        userId: viewers[i].user.uniqueId,
                        coins: parseInt(viewers[i].coinCount)
                    }
                }
                let gifterTable = $('#gifter-table tbody')
                //let tline = gifter_ary[gifter].username+','+gifter_ary[gifter].userId+','+gifter_ary[gifter].coins+"\n";
                gifterTable.prepend(`
                    <tr data-gifter="${gifter}">
                        <td>${gifter_ary[gifter].username}</td>
                        <td>${gifter_ary[gifter].userId}</td>
                        <td>${gifter_ary[gifter].coins}</td>
                    </tr>
                `)
                let line = gifter_ary[gifter].username+','+gifter_ary[gifter].userId+','+gifter_ary[gifter].coins+"\n";
                giftertotalcontainer.prepend(`
                    <li class="list-group-item list-group-item-action p-1" data-gifter="${gifter}">
                        ${line}
                    </li>
                `)
            }
        }
        container.html('<ul class="nav nav-pills">'+top+drop+drop_end+'</ul>');
        console.log(top)

    } else {
        container.html('no viewers..?')
        console.log('no viewers')
    }
}

// viewer stats
connection.on('roomUser', (msg) => {
    console.log('-- roomUser --')
    console.log(msg)
    console.log('-- roomUser --')
    if (typeof msg.viewerCount === 'number') {
        viewerCount = msg.viewerCount;
        updateRoomStats();
        updateTopGifters(msg.topViewers);
    }
})

// like stats
connection.on('like', (msg) => {
    if (typeof msg.totalLikeCount === 'number') {
        likeCount = msg.totalLikeCount;
        updateRoomStats();
    }

    if (window.settings.showLikes === "0") return;

    if (typeof msg.likeCount === 'number') {
        var uname = msg.uniqueId;
        if(uname in link_ary){
            link_ary[uname] = link_ary[uname]+1;
        } else {
            link_ary[uname] = 1
        }
        let tlike = $('.likecontainer')
        $(`[data-uname="${msg.uniqueId}"]`).remove()
        let thename = generateUsernameLink(msg)
        tlike.prepend(`<li data-uname="${msg.uniqueId}" class="list-group-item list-group-item-action p-1">
        <div class="static">
            <img class="miniprofilepicture" src="${msg.profilePictureUrl}">
            <span>
                <b>${thename}:</b>
                <span style="color:#447dd4"> sent ${link_ary[uname]} likes</span>
            </span>
        </div>
        </li>`)

    }
})

// Member join
let joinMsgDelay = 0;
connection.on('member', (msg) => {
    console.log('-- member --')
    console.log(msg)
    console.log('-- member --')
    if (window.settings.showJoins === "0") return;

    let addDelay = 250;
    if (joinMsgDelay > 500) addDelay = 100;
    if (joinMsgDelay > 1000) addDelay = 0;

    joinMsgDelay += addDelay;

    setTimeout(() => {
        joinMsgDelay -= addDelay;
        addChatItem('#21b2c2', msg, msg.label.replace('{0:user}', ''), '.sharecontainer'); //.joincontainer');
    }, joinMsgDelay);
})

// New chat comment received
connection.on('chat', (msg) => {
    console.log('-- chat --')
    console.log(msg)
    console.log('-- chat --')
    if (window.settings.showChats === "0") return;

    addChatItem('', msg, msg.comment, '.chatcontainer');
})

// New gift received
connection.on('gift', (data) => {
    console.log('-- gift --')
    console.log(data)
    console.log('-- gift --')
    if (!isPendingStreak(data) && data.diamondCount > 0) {
        diamondsCount += (data.diamondCount * data.repeatCount);
        updateRoomStats();
    }

    if (window.settings.showGifts === "0") return;

    addGiftItem(data);
})

// share, follow
connection.on('social', (data) => {
    console.log('-- social --')
    console.log(data)
    console.log('-- social --')
    if (window.settings.showFollows === "0") return;

    let color = data.displayType.includes('follow') ? '#ff005e' : '#2fb816';
    addChatItem(color, data, data.label.replace('{0:user}', ''), '.sharecontainer');

})

connection.on('streamEnd', () => {
    $('#stateText').text('Stream ended.');

    // schedule next try if obs username set
    if (window.settings.username) {
        setTimeout(() => {
            connect(window.settings.username);
        }, 30000);
    }
})

