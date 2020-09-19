
// Request to connect with MetaMask
// Returns bool: Connected or not
// If connected, acc will be set to the default account
async function requestAccount() {
    if (!window.ethereum) {
        const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
        await Swal.fire({
            icon: 'error',
            title: 'MetaMask not installed!',
            html: `You can install it <a href="${isFirefox?
                "https://addons.mozilla.org/en-US/firefox/addon/ether-metamask/":
                "https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn"}">here</a>!`,
        })
        return false;
    }

    let err = false;
    await window.ethereum.request({ method: "eth_requestAccounts"}) // ethereum.enable() is deprecated
    .then((accounts) => {
        acc = accounts[0];
    })
    .catch((e) => {
        if (e.code === 4001) {
            // EIP-1193 userRejectedRequest error
            console.log('Please connect to MetaMask!');
            Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: 'You rejected the connection!',
            })
        } else {
            console.error(e);
            Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: 'Connection failed!',
            })
        }
        err = true;
    })
    if (err) return false;
    
    checkNetwork();

    return true;
}


// Pop alert until the network ID is correct
async function checkNetwork() {
    while (window.ethereum.chainId != 3) {
        console.log("Please connect to the Ropsten Testnet!");
        await Swal.fire({
            icon: 'warning',
            title: 'Change network!',
            text: 'Please change the network to the Ropsten Testnet in the MetaMask menu!',
        })
    }
}


// Check if MetaMask is connected
// Returns bool: Connected to MetaMask or not
// If connected, acc will be set to the default account
async function getAccount() {
    if (!window.ethereum) {
        console.log("MetaMask not installed")
        return false;
    }

    let status = false;
    await window.ethereum.request({ method: 'eth_accounts' })
    .then((accounts) => {
        if (accounts.length) {
            acc = accounts[0];
            status = true;
        }
    })
    .catch((err) => {
        // Some unexpected error.
        // For backwards compatibility reasons, if no accounts are available,
        // eth_accounts will return an empty array.
        console.error(err);
    });
    return status;
}