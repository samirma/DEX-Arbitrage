const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();
const lib = require("./trade_lib");

require("dotenv").config({ path: "../.env" });
const wallet_address = process.env.address;

let config,arb;

config = lib.config;

const main = async () => {
	arb = await lib.getArbContract();
	const signer = await lib.getSignerOwner();
	//console.log(`Owner address: `, signer);
	console.log(`Contract Balance: `, config.arbContract);
	for (let i = 0; i < config.baseAssets.length; i++) {
		const asset = config.baseAssets[i];
		const tokenAsset = await lib.getToken(asset.address);
		const ownerBalance = await tokenAsset.balanceOf(wallet_address);
		console.log(`${asset.sym} Owner Balance: `,ownerBalance.toString());
		if (ownerBalance >0) {
			const arbBalance = await arb.getBalance(asset.address);
			console.log(`${asset.sym} Original Arb Balance: `,arbBalance.toString());
			const tx = await tokenAsset.connect(signer).transfer(config.arbContract,ownerBalance);
			await tx.wait();
			await new Promise(r => setTimeout(r, 10000));
		}
	const postFundBalance = await arb.getBalance(asset.address);
	console.log(`${asset.sym} New Arb Balance: `,postFundBalance.toString());
	}
	console.log('Note it might take a while for the funds to show up, try balances.js in a few mins');
}

process.on('uncaughtException', function(err) {
	console.log('UnCaught Exception 83: ' + err);
	console.error(err.stack);
	fs.appendFile('./critical.txt', err.stack, function(){ });
});

process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Rejection at: '+p+' - reason: '+reason);
});

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
