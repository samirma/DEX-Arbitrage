const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();
require("dotenv").config({ path: "../.env" });

const wallet_address = process.env.address;

let config,arb,inTrade, all, balances, routers;

const network = hre.network.name;
if (network === 'aurora') {
  config = require('./../config/aurora.json');
} else {
  config = require('./../config/fantom.json');
}

const initBalances = async () => {
  arb = await getArbContract();
 
  balances = {};
  for (let i = 0; i < config.baseAssets.length; i++) {
    const asset = config.baseAssets[i];
    const balanceAssert = await arb.getBalance(asset.address);
    var balance;
    const max = 990000000009999
    //if (balanceAssert > max) {
    if (false) {
      balance = ethers.BigNumber.from(max);
    } else {
      balance = balanceAssert.div(300);
    }
    //console.log(asset.sym, balance, balanceAssert);
    balances[asset.address] = { sym: asset.sym, balance, startBalance: balance };
  }

  routers = []

  for (let i = 0; i < config.routers.length; i++) {
    const router = config.routers[i];
    const UniRouterV2 = await hre.ethers.getContractAt("contracts/Arb.sol:IUniswapV2Router", router.address);
    routers[router.address] = UniRouterV2;
  }
  
}

async function getImpersonatedSigner(address) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address]
  });
  return ethers.provider.getSigner(address);
}

async function getSignerOwner() {

  [owner] = await ethers.getSigners();

  if (network === 'fantom') {
    return (await ethers.getSigners())[0];
  } else {
    return await getImpersonatedSigner(wallet_address);
  }
}

function getToken (address) {
  return ethers.getContractAt("IERC20", address);
}

async function getArbContract () {
    const IArb = await ethers.getContractFactory('Arb');
    let contractAddress;
    if (network === 'fantom') {
      contractAddress = config.arbContractProd;
    } else {
      contractAddress = config.arbContract;
    }
    console.log(contractAddress)
    const a = await IArb.attach(contractAddress);
    return a;
}

const getAmountOutMin = async (router, _tokenIn, _tokenOut, _amount) => {
    const path = [_tokenIn, _tokenOut];
    const amountOutMins = await routers[router].getAmountsOut(_amount, path);
    return amountOutMins[path.length -1];
  }
  
  const estimateDualDexTrade = async (_router1, _router2, _token1, _token2, _amount) => {
    let amtBack2 = ethers.BigNumber.from(0);
    try {
      const amtBack1 = await getAmountOutMin(_router1, _token1, _token2, _amount);
      amtBack2 = await getAmountOutMin(_router2, _token2, _token1, amtBack1);
      //console.log(`_router1 ${_router1} _router2 ${_router2}`);
    } catch (e) {
      //console.log(e);
    }
    return amtBack2;
  }
  
  const combs = (array) => {
    return array.flatMap(
        (v, i) => array.slice(i+1).map( w => [[v, w], [w, v]] )
    )
  }

const searchAllRoutes = () => {
    all = new Map();
    list = [];
    for (let i = 0; i < config.routers.length; i++) {
      list.push(config.routers[i].address);
      all.set(config.routers[i].address, config.routers[i].dex);
    }
    const routes = combs(list);
    const final_routes = []
    for (let i = 0; i < routes.length; i++) {
      final_routes.push(routes[i][0]);
      final_routes.push(routes[i][1]);
    }
    
    const allRoutes = [];
    for (let r = 0; r < final_routes.length; r++) {
      const route = final_routes[r];
  
      for (let b = 0; b < config.baseAssets.length; b++) {
        const asset = config.baseAssets[b].address;
        all.set(asset, config.baseAssets[b].sym);
        for (let t = 0; t < config.tokens.length; t++) {
          const token = config.tokens[t].address;
          all.set(token, config.tokens[t].sym);
          const targetRoute = {};
          targetRoute.router1 = route[0];
          targetRoute.router2 = route[1];
          targetRoute.token1 = asset;
          targetRoute.token2 = token;
          if (asset != token){
            allRoutes.push(targetRoute);
          }
        }
  
      }
    }
    //console.log(all);
    return allRoutes;
  }


  async function processRoute(targetRoute) {
    let tradeSize = balances[targetRoute.token1].balance;
    const amtBack = await estimateDualDexTrade(targetRoute.router1, targetRoute.router2, targetRoute.token1, targetRoute.token2, tradeSize);
    //const amtBack = await arb.estimateDualDexTrade(targetRoute.router1, targetRoute.router2, targetRoute.token1, targetRoute.token2, tradeSize);
    //console.log(`amtBackLocal ${amtBackLocal}  amtBack  ${amtBack} `);

    const multiplier = ethers.BigNumber.from(config.minBasisPointsPerTrade + 10000);
    const sizeMultiplied = tradeSize.mul(multiplier);
    const divider = ethers.BigNumber.from(10000);
    const profitTarget = sizeMultiplied.div(divider);
    if (!config.routes.length > 0) {
      //fs.appendFile(`./data/${network}RouteLog.txt`, `["${targetRoute.router1}","${targetRoute.router2}","${targetRoute.token1}","${targetRoute.token2}"],` + "\n", function (err) { });
    }
    if (amtBack.gt(profitTarget)) {
      console.log(`Profit ${amtBack}  ${profitTarget} ${all.get(targetRoute.token1)} ${all.get(targetRoute.token2)}  -  ${all.get(targetRoute.router1)}  ${all.get(targetRoute.router2)} `);
      owner = await getSignerOwner();
      await dualTrade(targetRoute.router1,targetRoute.router2,targetRoute.token1,targetRoute.token2,tradeSize, owner);
    } else {
      //await lookForDualTrade();
    }
  }


  const dualTrade = async (router1,router2,baseToken,token2,amount, owner) => {
    try {
      const before = await arb.getBalance(baseToken);
      console.log(`> Making dualTrade ${before} ${amount}...`);
      const tx = await arb.connect(owner).dualDexTrade(router1, router2, baseToken, token2, amount); //{ gasPrice: 1000000000003, gasLimit: 500000 }
      await tx.wait();
      const after = await arb.getBalance(baseToken);
      console.log(`> Profit ${after.sub(before)}`);
      //await lookForDualTrade();
    } catch (e) {
      console.log(e);
      //await lookForDualTrade();
    }
  }


module.exports = { getSignerOwner, estimateDualDexTrade, getToken, config, searchAllRoutes, processRoute, getArbContract, initBalances, getAmountOutMin};
