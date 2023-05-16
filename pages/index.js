import { createAlchemyWeb3 } from "@alch/alchemy-web3";
import { useRef, useEffect, useState } from "react";
import Web3 from "web3";
import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";
import CoinbaseWalletSDK from '@coinbase/wallet-sdk';
import Link from 'next/link';
import Head from 'next/head';
import Footer from '../components/Footer';
import { useStatus } from "../context/statusContext";
import { getNFTPrice, getTotalMinted } from "../utils/interact.js";

const contractABI = require("../pages/contract-abi.json");
const contractAddress = "0xd398f1a5aa236c013c78e99492fd7d50c54a1f45";

const { MerkleTree } = require('merkletreejs');
const KECCAK256 = require('keccak256');
const addresses = require('../utils/addresses');

const leaves = addresses.map(x => KECCAK256(x));
const tree = new MerkleTree(leaves, KECCAK256, { sortPairs: true })

const buf2hex = x => '0x' + x.toString('hex')



const web3 = createAlchemyWeb3(process.env.NEXT_PUBLIC_ALCHEMY_KEY);


const baseContract = new web3.eth.Contract(
  contractABI,
  contractAddress
);



const providerOptions = {
  walletconnect: {
    package: WalletConnectProvider, // required
    options: {
      rpc: process.env.NEXT_PUBLIC_ALCHEMY_KEY // required
    }
  }

};






export default function Home() {

  //State variables
  const [provider, setProvider] = useState();
  const [walletAddress, setAddress] = useState('');
  const [price, setPrice] = useState(0);
  const [totalMinted, setTotalMinted] = useState(0);
  const [count, setCount] = useState(1);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [pack, setPack] = useState(0);
  const [claimTime, setClaimTime] = useState(0);
  const [isPublic, setPublic] = useState(false);
  const [amount, setAmount] = useState();
  const [ethPrice, setEthPrice] = useState(0);
  const [isWhitelisted, setIsWhitelisted] = useState(false);




  useEffect(async () => {
    setPrice(await getNFTPrice());
    setTotalMinted(await getTotalMinted());
    getTimeLeft();
    getEth();
    checkSale();



  }, []);



  useEffect(() => {
    const interval = setInterval(() => {

      setClaimTime(claimTime => claimTime - 1);
    }, 1000);
    return () => clearInterval(interval);

  }, [])



  /*
    function addWalletListener() {
      if (window.ethereum) {
        window.ethereum.on("accountsChanged", (accounts) => {
          if (accounts.length > 0) {
            setWallet(accounts[0]);
            setStatus("👆🏽 Write a message in the text-field above.");
          } else {
            setWallet("");
            setStatus("🦊 Connect to Metamask using the top right button.");
          }
        });
      } else {
        setStatus(
          <p>
            {" "}
            🦊{" "}
            <a target="_blank" href={`https://metamask.io/download.html`}>
              You must install Metamask, a virtual Ethereum wallet, in your
              browser.
            </a>
          </p>
        );
      }
    }*/

  async function connectWallet() {

    try {

      let web3Modal = new Web3Modal({
        network: 'mainnet', // optional
        theme: 'dark',
        cacheProvider: false,

        providerOptions,

      });
      const web3ModalInstance = await web3Modal.connect();
      const provider = new Web3(web3ModalInstance);
      if (web3ModalInstance) {
        setProvider(provider);
        const accounts = await provider.eth.getAccounts();
        const address = accounts[0];
        setAddress(address);

        if (!isPublic) {
          checkWhitelist(address);
        }


      }
    } catch (error) {
      console.error(error)
    }
  }

  const checkSale = async () => {
    const sale = await baseContract.methods.publicMintActive().call()
    setPublic(sale)
  }

  const checkWhitelist = async (address) => {
    console.log(address)
    let leaf = buf2hex(KECCAK256(address));
    console.log("Leaf:" + leaf)
    let proof = tree.getProof(leaf).map(x => buf2hex(x.data));
    console.log(proof);
    const wlcheck = await baseContract.methods.isValid(proof, leaf).call()
    console.log(wlcheck)
    setIsWhitelisted(wlcheck)
  }


  const onMintPressed = async (e) => {
    e.preventDefault();
    const nftContract = new provider.eth.Contract(
      contractABI,
      contractAddress
    )
    let total = provider.utils.toWei(price, 'ether') * amount;
    /*
        if(pack === 1){
          total = provider.utils.toWei(price, 'ether') * 1000;
        } else {
         total = provider.utils.toWei(price, 'ether') * 100;
        }
        */




    let publicMintActive = await nftContract.methods.publicMintActive().call();

    if (publicMintActive) {
      await nftContract.methods.mint(amount).send({ from: walletAddress, value: total, gas: 250000 });
    } else {
      let leaf = buf2hex(KECCAK256(walletAddress));
      let proof = tree.getProof(leaf).map(x => buf2hex(x.data));
      await nftContract.methods.whitelistMint(proof, amount).send({ from: walletAddress, value: total, gas: 250000 });
    }



  }

  const getTimeLeft = async () => {
    let endTime;
    const isPublicSale = await baseContract.methods.publicMintActive().call();
    setPublic(isPublicSale);
    if (isPublicSale) {
      endTime = await baseContract.methods.publicEndTime().call();
    } else {
      endTime = await baseContract.methods.wlEndTime().call();

    }
    let start = (Date.now() / 1000);

    let countdown;
    if (endTime < start) {
      countdown = 0;
    } else {
      countdown = endTime - start;
    }
    console.log(countdown)
    setClaimTime(countdown);


  }

  const getEth = () => {
    const { getEthPriceNow, getEthPriceHistorical } = require('get-eth-price');

    getEthPriceNow()

      .then(data => {
        var rawdata = JSON.stringify(data);
        var prices = rawdata.split(',')
        var usd = prices[1].match(/\d+/g);
        var ethusd = parseInt(usd[0]);


        setEthPrice(ethusd);
      }

      )
  }


  /*const getTimeLeft = async () => {
    
    
    
    let start = (Date.now() / 1000);
    
    let countdown;
    if (endTime < start) {
        countdown = "Ended";
    } else {
        let seconds = endTime - start;
        countdown = secondsToDhms(seconds);
        
    }
  }*/

  function secondsToDhms(seconds) {

    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600 * 24));
    var h = Math.floor(seconds % (3600 * 24) / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = Math.floor(seconds % 60);

    var dDisplay = d > 0 ? d + ":" : "";
    var hDisplay = h > 0 ? (h < 10 ? "0" + h + ":" : h + ":") : "";
    var mDisplay = m > 0 ? (m < 10 ? "0" + m + ":" : m + ":") : "";
    var sDisplay = s > 0 ? (s < 10 ? "0" + s : s) : "";

    if (isPublic) {
      if (seconds !== 0) {
        return `Public Round ends in ${dDisplay}${hDisplay}${mDisplay}${sDisplay}`;
      } else {
        return `Public Round has ended!`
      }

    } else {
      if (seconds !== 0) {
        return `WL Round ends in ${dDisplay}${hDisplay}${mDisplay}${sDisplay}`;
      } else {
        return `WL Round has ended!`
      }

    }


  }








  return (
    <>
      <Head>
        <title>Pepellars</title>
        <meta name="description" content="Pepellars NFT Dapp" />
        <link rel="icon" href="/" />
      </Head>

      <header className='fixed w-full top-0 md:px-8 px-5 pt-5 pb-3 z-70 transition-colors duration-500 z-40 flex-none md:z-50 bg-pale'>

        {/* Header Container */}
        <div className='flex h-full items-center justify-center max-w-11xl mx-auto border-opacity-0'>

          {/* Logo Section */}

          <div className='flex-grow'>
            <div className='flex'>
              <Link className='w-min-content' href='/' passHref>
                <a className='flex text-frogger text-2xl'>
                  Pepellars

                </a>
              </Link>
            </div>
          </div>



          <nav>

            <section className="MOBILE-MENU flex lg:hidden">
              <div
                className="HAMBURGER-ICON space-y-2"
                onClick={() => setIsNavOpen((prev) => !prev)}
              >
                <span className="block h-0.5 w-12 animate-pulse bg-black"></span>
                <span className="block h-0.5 w-12 animate-pulse bg-black"></span>
                <span className="block h-0.5 w-12 animate-pulse bg-black"></span>
              </div>

              <div className={isNavOpen ? "showMenuNav" : "hideMenuNav"}>
                <div
                  className="absolute top-0 right-0 px-8 py-8"
                  onClick={() => setIsNavOpen(false)}
                >
                  <svg
                    className="h-8 w-8 text-gray-600"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
                <div className=''>
                  <ul className="flex flex-col items-center justify-between min-h-[250px]">
                    <li className="border-b text-white border-gray-400 my-2 uppercase">
                      <a href="https://pepellars.wtf/">WTF?!</a>
                    </li>

                    <li>

                      {walletAddress.length > 0 ? (

                        <div className='px-4 bg-opacity-20 text-white items-center relative h-9 tracking-wider sm:pt-0.5 md:pt-2 lg:pt-0.5 first::pt-0 duration-500 text-6xs md:text-base padding-huge opacity-100 hover:bg-opacity-70 rounded flex justify-center flex-row border border-gray-900 hover:shadow-green-500/20 cursor-pointer'
                        >
                          {String(walletAddress).substring(0, 6)}
                          {"....."}
                          {String(walletAddress).substring(39)}
                        </div>
                      ) : (

                        <button className='px-4 bg-titanium bg-opacity-100 text-gray-100 items-center relative h-9 tracking-wider pt-0.5 first::pt-0 duration-500 text-2xs md:text-base padding-huge opacity-100 hover:bg-opacity-100 rounded flex justify-center flex-row bg-gradient-to-tl hover:from-greenn from-peach to-peach hover:to-bluee border-none hover:shadow-green-500/20 cursor-pointer' id="walletButton"

                          onClick={connectWallet}
                        >Connect
                        </button>
                      )}
                    </li>


                  </ul>
                </div>
              </div>
            </section>

            <ul className="DESKTOP-MENU hidden space-x-2 lg:flex">


              <li>
                <a href="https://pepellars.wtf/" className='hidden sm:flex bg-opacity-0 text-white opacity-80 items-center relative h-9 tracking-widest pt-0.5 first::pt-0 uppercase text-lg padding-huge bg-blue-300 duration-200 px-3 hover:bg-opacity-90 flex justify-center flex-row cursor-pointer '>
                  <p className='rounded uppercase text-xs font-black
          text-black md:flex'>WTF?!</p>
                </a>
              </li>

              {/* CONNECT WALLET */}
              <li>
                {walletAddress.length > 0 ? (

                  <div className='px-4 bg-opacity-20 text-frogger items-center relative h-9 tracking-wider sm:pt-0.5 md:pt-2 lg:pt-0.5 first::pt-0 duration-500 text-6xs md:text-base padding-huge opacity-100 hover:bg-opacity-70 rounded flex justify-center flex-row border border-frogger hover:shadow-green-500/20 cursor-pointer'
                  >
                    {String(walletAddress).substring(0, 6)}
                    {"....."}
                    {String(walletAddress).substring(39)}
                  </div>
                ) : (

                  <button className='px-4 bg-frogger bg-opacity-100 text-gray-100 items-center relative h-9 tracking-wider pt-0.5 first::pt-0 duration-500 text-2xs md:text-base padding-huge opacity-100 hover:bg-opacity-100 rounded flex justify-center flex-row bg-gradient-to-tl hover:from-greenn from-peach to-peach hover:to-bluee border-none hover:shadow-green-500/20 cursor-pointer' id="walletButton"

                    onClick={connectWallet}
                  >Connect
                  </button>
                )}
              </li>

            </ul>
          </nav>
          <style>{`
      .hideMenuNav {
        display: none;
      }
      .showMenuNav {
        display: block;
        position: absolute;
        width: 100%;
        height: 100vh;
        top: 0;
        left: 0;
        background: #000;
        z-index: 10;
        display: flex;
        flex-direction: column;
        justify-content: space-evenly;
        align-items: center;
      }
    `}</style>
        </div>

      </header>





      {/* Hero/Mint Section */}
      <section className="flex items-center flex-row-reverse justify-center bg-pale !py-20 px-5 overflow-hidden relative z-1" id="">

        {/* margin between header and hero section */}
        <div className="mb-2 flex items-center max-w-md mt-2"></div>

        <div className="flex flex-col items-center justify-center md:flex-row md:items-center md:justify-between text-slate-900">

          {/* Left Hero Section - Mint Info */}
          <div className="w-full px-4">








            {/* Total supply - Price info */}
            <div className='flex flex-col bg-white border border-cream bg-opacity-50 items-center justify-center justify-between text-black rounded-md w-3/4 md:w-[700px] mt-5 mx-auto px-12 py-4'>


              <p className='text-frogger text-center text-2xl md:text-3xl uppercase font-bold mt-2 p-6'>Mint Your Pepellars</p>
              <span className='flex flex-row text-black text-xs px-2'><p className='px-2'>1. Connect</p> <p className='px-2'>2. Enter Pepellars Amount</p> <p className='px-2'>3. Mint!</p></span>
              <p className='text-red-500 font-bold text-2xl p-4 my-1'>{secondsToDhms(claimTime)}</p>
              <p className='text-black font-bold text-3xl p-4 my-1'>{totalMinted}/1,000,000</p>
              <p className='text-frogger font-bold text-2xl p-4 my-1'>1 PEPELLAR = ~{price} ETH</p>






              {/* Increment & Decrement buttons */}
              {(walletAddress && totalMinted < 1 * 10 ** 6) ? (

                <div className='flex flex-col w-full'>
                  {isPublic ? (

                    <div className='flex flex-col lg:flex-row justify-center w-full'>
                      <div className='flex flex-col lg:flex-row items-center w-full justify-between px-1 md:px-4 m-4 bg-transparent rounded-lg'>
                        <input className='flex w-full !border-2 !border-frogger !rounded-md text-center lg:w-1/2 h-12 p-0 text-lg lg:text-xs' value={amount} placeholder='Pepellars amount' onChange={(e) => { setAmount(e.target.value) }} />
                        {/*{pack === 0 ? (
     <button onClick={() => {setPack(0)}} className="flex items-center justify-between rounded-lg py-2 px-3 mx-1 bg-frogger text-center text-white text-2xl md:text-4xl">
     100
    </button>
  ):(
    <button onClick={() => {setPack(0)}} className="flex items-center justify-between rounded-lg py-2 px-3 mx-1 bg-gray-300 text-center text-white text-2xl md:text-4xl">
     100
    </button>
  )}

  {pack === 1 ? (
     <button onClick={() => {setPack(1)}} className="flex items-center justify-between rounded-lg py-2 px-3 mx-1 bg-frogger text-center text-white text-2xl md:text-4xl">
     1000
    </button>
  ):(
    <button onClick={() => {setPack(1)}} className="flex items-center justify-between rounded-lg py-2 px-3 mx-1 bg-gray-300 text-center text-white text-2xl md:text-4xl">
     1000
    </button>
  )}*/}

                        <div className='flex flex-row h-12 w-full text-md lg:w-1/2 mx-2 py-2 whitespace-nowrap'>
                          <span className='flex whitespace-nowrap'><p>=~{amount ? (amount / 18182).toFixed(4) : 0} ETH</p><p className='text-gray-600 ml-2'>(${amount ? parseInt((amount / 18182) * ethPrice).toFixed(0) : 0})</p></span>
                        </div>

                      </div>

                      <button
                        className='text-2xl md:text-5xl font-semibold my-4 mx-1 h-16 bg-opacity-100 rounded-md uppercase font-base text-white px-8 tracking-widest bg-frogger hover:bg-bluee'
                        // onClick={mintPass}
                        onClick={onMintPressed}
                      >
                        Mint
                      </button>


                    </div>

                  ) : (
                    <>
                      {isWhitelisted ? (
                        <>

                          <div className='flex flex-col lg:flex-row justify-center w-full'>
                            <div className='flex flex-col lg:flex-row items-center w-full justify-between px-1 md:px-4 m-4 bg-transparent rounded-lg'>
                              <input className='flex w-full !border-2 !border-frogger !rounded-md text-center lg:w-1/2 h-12 p-0 text-lg lg:text-xs' value={amount} placeholder='Pepellars amount' onChange={(e) => { setAmount(e.target.value) }} />
                             

                              <div className='flex flex-row h-12 w-full text-md lg:w-1/2 mx-2 py-2 whitespace-nowrap'>
                                <span className='flex whitespace-nowrap'><p>=~{amount ? (amount / 18182).toFixed(4) : 0} ETH</p><p className='text-gray-600 ml-2'>(${amount ? parseInt((amount / 18182) * ethPrice).toFixed(0) : 0})</p></span>
                              </div>

                            </div>

                            <button
                              className='text-2xl md:text-5xl font-semibold my-4 mx-1 h-16 bg-opacity-100 rounded-md uppercase font-base text-white px-8 tracking-widest bg-frogger hover:bg-bluee'
                              // onClick={mintPass}
                              onClick={onMintPressed}
                            >
                              Mint
                            </button>


                          </div>
                        </>
                      ) : (
                        <>


                          <div className='flex flex-col lg:flex-row justify-center w-full'>
                            <div className='flex flex-col lg:flex-row items-center w-full justify-between px-1 md:px-4 m-4 bg-transparent rounded-lg'>
                              <div className='flex w-full bg-red-500 border-4 border-white text-lg p-4 text-center text-white'>
                                You are not whitelisted. Do not attempt to mint this round.
                              </div>

                            </div>


                          </div>
                          </>


                  
                    )}



                        </>

                      )}



                      <div className='px-4 my-6 bg-opacity-20 text-black items-center relative h-9 tracking-wider sm:pt-0.5 md:pt-2 lg:pt-0.5 first::pt-0 duration-500 text-sm md:text-base padding-huge opacity-100 hover:bg-opacity-70 rounded flex justify-center flex-row border border-black hover:shadow-green-500/20 cursor-pointer'
                      >
                        Connected:{String(walletAddress).substring(0, 6)}
                        {"....."}
                        {String(walletAddress).substring(39)}
                      </div>
                    </div>


                  ) : (
                  <>

                    <div className='flex flex-col w-full'>
                      <div className='flex flex-col lg:flex-row justify-center w-full'>
                        <div className='flex flex-col lg:flex-row items-center w-full justify-between px-1 md:px-4 m-4 bg-transparent rounded-lg'>
                          <input className='flex w-full !border-2 !border-frogger !rounded-md text-center lg:w-1/2 h-12 p-1 text-lg lg:text-xs' value={amount} placeholder='Pepellars amount' onChange={(e) => { setAmount(e.target.value) }} />
                          {/*} {pack === 0 ? (
                         <button onClick={() => {setPack(0)}} className="flex items-center justify-between rounded-lg py-2 px-3 mx-1 bg-frogger text-center text-white text-2xl md:text-4xl">
                         100
                        </button>
                      ):(
                        <button onClick={() => {setPack(0)}} className="flex items-center justify-between rounded-lg py-2 px-3 mx-1 bg-gray-300 text-center text-white text-2xl md:text-4xl">
                         100
                        </button>
                      )}

                      {pack === 1 ? (
                         <button onClick={() => {setPack(1)}} className="flex items-center justify-between rounded-lg py-2 px-3 mx-1 bg-frogger text-center text-white text-2xl md:text-4xl">
                         1000
                        </button>
                      ):(
                        <button onClick={() => {setPack(1)}} className="flex items-center justify-between rounded-lg py-2 px-3 mx-1 bg-gray-300 text-center text-white text-2xl md:text-4xl">
                         1000
                        </button>
                      )}*/}
                          <div className='flex flex-row h-12 w-full text-md lg:w-1/2 mx-2 py-2 whitespace-nowrap'>
                            <span className='flex whitespace-nowrap'><p>=~{amount ? (amount / 18182).toFixed(4) : 0} ETH</p><p className='text-gray-600 ml-2'>(${amount ? parseInt((amount / 18182) * ethPrice).toFixed(0) : 0})</p></span>
                          </div>

                        </div>


                        <button
                          className='text-2xl md:text-5xl font-semibold my-4 mx-1 h-16 bg-opacity-50 rounded-md uppercase font-base text-white px-4 tracking-widest bg-black hover:shadow-green-500/20'
                          // onClick={mintPass}
                          onClick={onMintPressed}
                        >
                          Mint
                        </button>
                      </div>

                      <div className='flex flex-col items-center justify-center'>

                        <button className='w-2/3 md:w-1/2 text-sm md:text-lg px-3 md:px-0 mt-5 bg-black bg-opacity-100 text-white items-center h-12 relative tracking-wider pt-0.5 first::pt-0 duration-200 hover:bg-opacity-70 font-400 rounded text-2xs' id="walletButton"

                          onClick={connectWallet}
                        >Connect Wallet
                        </button>

                        <p className='text-center flex flex-col font-bold text-gray-700 text-base md:text-xl text-body-color leading-relaxed m-3 md:m-8 break-words ...'>
                          Not connected!
                        </p>
                      </div>
                    </div>

                  </>
              )}
                </div>








            {/* Total:  {nftPrice} + Gas */}
              {/* Mint Status */}
              {/* {status && (
      <div className="flex items-center justify-center">
        {status}
      </div>
    )} */}



              {/* Right Hero Section - Video/Image Bird PASS */}

            </div>
            <div className='flex flex-col items-center lg:w-1/2 h-full text-center'>
              <img src='/images/pepes.png' className='flex h-full mb-2' />
              <p>Future of memes</p>
            </div>
          </div>
      </section>


      {/* Content + footer Section */}
      <Footer />
    </>
  )
}

