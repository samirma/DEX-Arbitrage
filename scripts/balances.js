const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();
const lib = require("./trade_lib");

require("dotenv").config({ path: "../.env" });
const wallet_address = process.env.address;

let config,arb,owner;
const network = hre.network.name;

config = lib.config;

const main = async () => {
	[owner] = await ethers.getSigners();
	console.log(`Owner: ${owner.address}`);
	arb = await lib.getArbContract();
	for (let i = 0; i < config.baseAssets.length; i++) {
		const asset = config.baseAssets[i];
		const tokenAsset = await lib.getToken(asset.address);
		const ownerBalance = await tokenAsset.balanceOf(owner.address);
		console.log(`${asset.sym} Owner Balance: `,ownerBalance.toString());
		const arbBalance = await arb.getBalance(asset.address);
		console.log(`${asset.sym} Arb Balance: `,arbBalance.toString());
	}
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



module.exports = { initBalances, balances, routers};
