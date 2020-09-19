
$(document).ready(async function() {
    if (await getAccount()){
        // MetaMask is connected
        await checkNetwork();
        w3 = new Web3(window.ethereum);
        logged_in = true;

        w3.eth.getBalance(acc, web3.eth.defaultBlock, (e, bal) => {
            $("#account").text(`${acc} with ${w3.utils.fromWei(bal, "ether")} ETH`);
        })
    } else {
        await requestAccount()
        location.reload();
    }

    // Connect to contract
    contract = new w3.eth.Contract(await $.get(contractABI), contractAddress);
    // console.log(contract);
        
    // Get role
    await contract.methods.getRole().call().then((res) => {
        if (res == 2) {
            role = "admin";
            $("#role").text("Admin");
        } else if (res == 1) {
            role = "rater";
            contract.methods.raters(acc).call().then((r) => {
                rater_points = r.points;
                rater_disabled = r.disabled;
                $("#role").text(`Professor ${rater_disabled? "(Disabled)": ""} with ${rater_points} points`);
            })
        } else {
            role = "student";
            $("#role").text("Student");
        }
    })

    // Get categories
    contract.methods.getCategories().call().then((res) => {
        const type = $("#type");
        res.forEach((category, i) => {
            type.append(`<option value="${i}">${category}</option>`)
        })
    })
        
})


function uploadWork() {
    // Get type
    $("#submit").attr("disabled", true)
    const type = 1 << $("#type").val();
    contract.methods.uploadWork($("#name").val(), $("#description").val(), "", type).send({
        from: acc
    }).then((receipt) => {
        console.log(receipt)
        Swal.fire({
            icon: 'success',
            text: 'Uploaded!',
            footer: `<a href="https://ropsten.etherscan.io/tx/${receipt.transactionHash}">View transaction on Etherscan</a>`
        }).then(() => {
            location.href = "/works";
        })
    }).catch((err) => {
        console.log(err);
        if (err.code == 4001) { // User denied
            Swal.fire({
                icon: 'error',
                text: 'You canceled the transaction!',
            })
        } else {
            Swal.fire({
                icon: 'error',
                text: 'Transaction failed!!',
                footer: `<a href="https://ropsten.etherscan.io/tx/${err.transactionHash}">View on Etherscan for more details</a>`
            })
        }
        
    })
}
