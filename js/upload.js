
$(document).ready(async function() {

    if (await getAccount()){
        // MetaMask is connected
        await checkNetwork();
        w3 = new Web3(window.ethereum);
        w3.eth.defaultAccount = acc;
        logged_in = true;

        w3.eth.getBalance(acc, w3.eth.defaultBlock, (e, bal) => {
            $("#account").text(`${w3.utils.toChecksumAddress(acc)} with ${w3.utils.fromWei(bal, "ether")} ETH`);
        })
    } else {
        if (await requestAccount()) {
            location.reload();
        } else {
            history.back();
        }
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
        type.multiselect();
    })
    
        
})


function uploadWork() {

    // Get type
    const title = $("#name").val();
    const desc = $("#description").val();
    const location = $("#location").val();
    const image = $("#image")[0].files[0];

    let type = 0;
    $('#type option:selected').each((i, e) => {
        type |= 1 << e.value;
    })


    // Upload image
    // WARNING: Callback hell ahead!!
    Swal.fire({
        title: "Uploading image...",
        icon: "info",
        allowOutsideClick: () => !Swal.isLoading(),
        allowEscapeKey: () => !Swal.isLoading(),
        onOpen: () => {
            Swal.showLoading();
            postToImgur(image).then((response) => {
                if (!response.success) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Oh no!',
                        text: 'Image upload failed!'
                    })
                    return;
                }
                const img_link = response.data.link;
                // Upload finished
                // Comfirm upload
                Swal.fire({
                    title: title,
                    text: desc,
                    imageUrl: img_link,
                    showLoaderOnConfirm: true,
                    confirmButtonText: 'Upload!',
                    showCancelButton: true,
                    footer: "You can not edit or delete the work after uploading!",
                    allowOutsideClick: () => !Swal.isLoading(),
                    allowEscapeKey: () => !Swal.isLoading(),
                    preConfirm: async (value) => {
                        // Confirmed, Start transaction
                        return contract.methods.uploadWork(title, desc, img_link, location, type).send({
                            from: acc
                        })
                        .once('transactionHash', (hash) => {
                            $(Swal.getFooter()).html(`<div style="text-align: center;"><a>Your trasaction is being processed...</a><br><a href="https://ropsten.etherscan.io/tx/${hash}">View transaction on Etherscan</a></div>`).attr("style", "display: flex;")
                        })
                        .then((receipt) => {
                            console.log(receipt)
                            Swal.fire({
                                icon: 'success',
                                text: 'Work uploaded!',
                                footer: `<a href="https://ropsten.etherscan.io/tx/${receipt.transactionHash}">View transaction on Etherscan</a>`
                            }).then(() => {
                                location.href = "/works"
                            })
                        })
                        .catch((err) => {
                            console.log(err);
                            if (err.code == 4001) { // User denied
                                Swal.showValidationMessage(
                                    "You canceled the transaction!"
                                )
                            } else {
                                Swal.showValidationMessage(
                                    "Transaction failed!!<br>View transaction on Etherscan for details"
                                )
                                Swal.fire({
                                    icon: 'error',
                                    text: 'Transaction failed!!',
                                    footer: `<a href="https://ropsten.etherscan.io/tx/${err.transactionHash}">View on Etherscan for more details</a>`
                                })
                            }
                        })
                    }
                })
            })
        }
    })
}


async function postToImgur(image) {
    var formData = new FormData();
    formData.append("image", image);
    return await $.ajax({
        url: "https://api.imgur.com/3/image",
        type: "POST",
        datatype: "json",
        headers: {
            Authorization: `Client-ID ${imgurClientID}`,
        },
        data: formData,
        cache: false,
        contentType: false,
        processData: false,
    });
}