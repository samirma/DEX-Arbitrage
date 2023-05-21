const hre = require("hardhat");
const fs = require("fs");
const { exit } = require("process");
require("dotenv").config();
require("dotenv").config({ path: "../.env" });

const wallet_address = process.env.address;

let config,arb,inTrade, all, balances, routers;

const network = hre.network.name;

function getConfig(network) {
  let config;
  switch (network) {
    case 'aurora':
      config = require('./../config/aurora.json');
      break;
    case 'fantom':
      config = require('./../config/fantom.json');
      break;
    case 'binance':
      config = require('./../config/bsc.json');
      break;
    case 'forking':
      config = require('./../config/bsc.json');
      break;
  }
  return config;
}

config = getConfig(network);

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
  if (network === 'forking') {
    return await getImpersonatedSigner(wallet_address);
  } else {
    return (await ethers.getSigners())[0];
  }
}

function getToken (address) {
  return ethers.getContractAt("IERC20", address);
}

async function getArbContract () {
    const IArb = await ethers.getContractFactory('Arb');
    let contractAddress = config.arbContract;
    return await IArb.attach(contractAddress);
}

  const getAmountOutMin = async (router, _tokenIn, _tokenOut, _amount) => {
    if (_tokenIn == _tokenOut) {
      return _amount;
    }
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

  const estimateDualDexTradeContract = async (_router1, _router2, _token1, _token2, _amount) => {
    let result = ethers.BigNumber.from(0);
    try {
      result = await arb.estimateDualDexTrade(_router1, _router2, _token1, _token2, _amount);
    } catch (error) {
      //console.log(e);
    }
    return result;
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
    var tradeSize = balances[targetRoute.token1].balance;
    if (tradeSize == 0) {
      return
    }
    tradeSize = ethers.BigNumber.from(10000000000)
    //console.log(`--- ${all.get(targetRoute.token1)} ${all.get(targetRoute.token2)}  -  ${all.get(targetRoute.router1)}  ${all.get(targetRoute.router2)} `);
    //const amtBack = await estimateDualDexTrade(targetRoute.router1, targetRoute.router2, targetRoute.token1, targetRoute.token2, tradeSize);
    const amtBack = await estimateDualDexTradeContract(targetRoute.router1, targetRoute.router2, targetRoute.token1, targetRoute.token2, tradeSize);
    
    //console.log(`${balances[targetRoute.token1].sym} result: ${amtBack} `);

    const multiplier = ethers.BigNumber.from(config.minBasisPointsPerTrade + 10000);
    const sizeMultiplied = tradeSize.mul(multiplier);
    const divider = ethers.BigNumber.from(10000);
    const profitTarget = sizeMultiplied.div(divider);
    if (!config.routes.length > 0) {
      //fs.appendFile(`./data/${network}RouteLog.txt`, `["${targetRoute.router1}","${targetRoute.router2}","${targetRoute.token1}","${targetRoute.token2}"],` + "\n", function (err) { });
    }
    if (amtBack.gt(profitTarget)) {
      const difference = amtBack.sub(tradeSize);
      console.log(` Profit of ${difference} final balance: ${amtBack} ${all.get(targetRoute.token1)} ${all.get(targetRoute.token2)}  -  ${all.get(targetRoute.router1)}  ${all.get(targetRoute.router2)} `);
      owner = await getSignerOwner();
      await dualTrade(targetRoute.router1,targetRoute.router2,targetRoute.token1,targetRoute.token2, tradeSize, owner, difference, config.weth, config.usd);
    } else {
      //await lookForDualTrade();
    }
  }

  const dualTrade = async (router1, router2, baseToken, token2, amount, owner, profit, wethAddress, usdtAddress) => {
    try {
      const wallet_address = await owner.getAddress()
      const before = await arb.getBalance(baseToken);
      console.log(`> Making dualTrade ${before} ${amount}...`);
      const gasPrice = await owner.getGasPrice();
      const gasEstimate = await arb.connect(owner).estimateGas.dualDexTrade(router1, router2, baseToken, token2, amount);
      const gasCost = gasPrice.mul(gasEstimate);
      const gasCostInUSDT = await getAmountOutMin(router1, wethAddress, usdtAddress, gasCost);
      const profitInUSDT = await getAmountOutMin(router1, baseToken, usdtAddress, profit);
      if (profitInUSDT.gt(gasCostInUSDT) || true) {
        console.log(`> Current gas balance ${await getEthBalanceInUsd(wallet_address)} estimate cost ${await getTokenBalanceInUsd(usdtAddress, gasCostInUSDT)}`);
        const tx = await arb.connect(owner).dualDexTrade(router1, router2, baseToken, token2, amount);
        await tx.wait();
        const after = await arb.getBalance(baseToken);
        console.log(`> New balance: ${after} Profit ${after.sub(before)} new gas usd balance ${await getEthBalanceInUsd(wallet_address)}`);
      } else {
        const gasFormated = await getTokenBalanceInUsd(usdtAddress, gasCostInUSDT)
        const profitFormated = await getTokenBalanceInUsd(baseToken, profit);
        console.log(`Gas cost in USDT: ${gasFormated} is not higher than rounded profit in USDT: ${profitFormated}`);
      }
    } catch (e) {
      console.log(e);
    }
  }
  
  const getTokenBalanceInUsd = async (tokenAddress, amount) => {
    let tokenUsdRate
    if (amount == 0) {
      tokenUsdRate = amount;
    } else {
      const amountsOut = await getAmountOutMin(routers[config.routers[0].address], tokenAddress, config.usd, amount);
      tokenUsdRate = parseFloat(ethers.utils.formatUnits(amountsOut, await getDecimals(config.usd)));
    }

    // Convert the token balance to USD
    const balanceInUsd = ethers.utils.formatUnits(amount, await getDecimals(tokenAddress)) * tokenUsdRate;
    return Number(balanceInUsd.toFixed(20));
  }

  const getEthBalanceInUsd = async (walletAddress) => {
    const balanceInWei = await ethers.provider.getBalance(walletAddress);
    const balanceInEth = ethers.utils.formatEther(balanceInWei);

    const decimals = await getDecimals(config.usd)
    
    // Get the current ETH/USD exchange rate from Uniswap
    const amountsOut = await routers[config.routers[0].address].getAmountsOut(ethers.utils.parseEther('1'), [config.weth, config.usd]);
    const ethUsdRate = parseFloat(ethers.utils.formatUnits(amountsOut[1], decimals));
  
    // Convert the ETH balance to USD
    const balanceInUsd = balanceInEth * ethUsdRate;
    return balanceInUsd;
  }
  
  const getDecimals = async (tokenAddress) => {
    const tokenAbi = [
      {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [
          {
            "name": "",
            "type": "uint8"
          }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
      }
    ];
  
    const token = new ethers.Contract(tokenAddress, tokenAbi, ethers.provider);

    return await token.decimals();
  }
  

module.exports = { getTokenBalanceInUsd, getSignerOwner, estimateDualDexTrade, getToken, config, searchAllRoutes, processRoute, getArbContract, initBalances, getAmountOutMin, getEthBalanceInUsd};
