$(document).ready(() => {
    $('#connectButton').click(() => {
        let uniqueId = $('#uniqueIdInput').val();
        if (uniqueId !== '') {
            connect(uniqueId);
        } else {
            alert('no username entered');
        }
    });
})

function connect(uniqueId) {
    ioConnection.emit('setUniqueId', uniqueId);
    $('#stateText').text('Connecting...');
}

function sanitize(text) {
    return text.replace(/</g, '&lt;')
}

function addChatItem(color, data, text, summarize) {
    if ($('.chat').find('div').length > 500) {
        $('.chat').find('div').slice(0, 200).remove();
    }

    $('.chat').find('.temporary').remove();;
    
    $('.chat').append(`
        <div class=${summarize ? 'temporary' : 'static'}>
            <img src="${data.profilePictureUrl}">
            <span>
                <b>${data.uniqueId}:</b> 
                <span style="color:${color}">${sanitize(text)}</span>
            </span>
        </div>
    `);

    $(".chat").stop();
    $(".chat").animate({
        scrollTop: $('.chat')[0].scrollHeight
    }, 800);
}

let ioConnection = new io();

// Control events
ioConnection.on('setUniqueIdSuccess', (state) => {
    $('#stateText').text(`Connected with roomId ${state.roomId}`);
})

ioConnection.on('setUniqueIdFailed', (errorMessage) => {
    $('#stateText').text(errorMessage);
})

ioConnection.on('streamEnd', () => {
    $('#stateText').text('Stream ended.');
})

// Chat events
ioConnection.on('member', (msg) => {
    addChatItem('#21b2c2', msg, 'joined', true);
})

ioConnection.on('chat', (msg) => {
    addChatItem('', msg, msg.comment);
})

ioConnection.on('gift', (msg) => {
    addChatItem('#c2a821', msg, `Gifted giftId=${msg.giftId}`);
})