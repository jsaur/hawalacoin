import React, { useCallback, useEffect, useState } from 'react';
import { BigNumber } from 'bignumber.js';
import { StableToken } from '@celo/contractkit';
import { useContractKit } from '@celo-tools/use-contractkit';
import Web3 from 'web3';
import hawalaJson from '../truffle/build/contracts/HawalaCoin.json';
import Head from 'next/head';
import { PrimaryButton } from '../components/buttons';
import { toast } from '../components';

const defaultSummary = {
  name: '',
  address: '',
  wallet: '',
  celo: new BigNumber(0),
  cusd: new BigNumber(0)
};
const defaultGasPrice = 100000000000;
const ERC20_DECIMALS = 18;

function truncateAddress(address: string) {
  return `${address.slice(0, 8)}...${address.slice(36)}`;
}

export default function Home(): React.ReactElement {
  const {
    kit,
    address,
    network,
    updateNetwork,
    connect,
    destroy,
    performActions,
    walletType,
  } = useContractKit();
  const [summary, setSummary] = useState(defaultSummary);
  let [loans, setLoans] = useState([]);
  const [transacting, setTransacting] = useState(false);
  const [loading, setLoading] = useState(false);
  

  // TODO Move these to configs
  // Alfajores
  const hawalaAddress = '0x48f6848cA5737A94902772f48bA894E1b8F9A848';
  const cusdAddress = '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1';
  const hawalaAbi: any = hawalaJson.abi; // hack to fix abi types
  const hawalaContract = new kit.web3.eth.Contract(hawalaAbi, hawalaAddress);

  /**
   * Fetches account summary and token balances
   */
  const fetchSummary = useCallback(async () => {
    if (!address) {
      setSummary(defaultSummary);
      return;
    }

    const [accounts, goldToken, cUSD] = await Promise.all([
      kit.contracts.getAccounts(),
      kit.contracts.getGoldToken(),
      kit.contracts.getStableToken(StableToken.cUSD),
    ]);
    const [summary, celo, cusd] = await Promise.all([
      accounts.getAccountSummary(address).catch((e) => {
        console.error(e);
        return defaultSummary;
      }),
      goldToken.balanceOf(address),
      cUSD.balanceOf(address)
    ]);
    setSummary({
      ...summary,
      celo,
      cusd
    });
  }, [address, kit]);


  /**
   * Wrapper function for contract calls to handle the transacting flag and errors
   */
  async function wrapContractCall(fn: (...args: any) => void, ...args: any) {
    try {
      setTransacting(true);
      await fn(...args);
    } catch (e) {
      console.log(e);
      toast.error((e as Error).message);
    } finally {
      setTransacting(false);
    }
  }

  /** 
   * 
   */
  async function mint() {
    console.log('mint');
  }

  /**
   * 
   */
  async function burn() {
    console.log('burn');
  }



  /**
   * Helper function to get role
   */
  function currentState(roleId: string) {
    switch(roleId) {
      case "0":
        return 'Not Assigned';
      case "1":
        return 'Donor';
      case "2":
        return 'Client';
      case "3":
        return 'CSO';
      case "4":
        return 'Agent';
      default:
        return 'Not Assigned'
    }
  }

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  return (
    <div>
      <Head>
        <title>HawalaCoin</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="max-w-screen-sm mx-auto py-10 md:py-20 px-4">
          <h1 className="font-bold text-gray-700">Hawala Coin</h1>
          {address ? 
            (<PrimaryButton onClick={() => 
              destroy().catch((e) => toast.error((e as Error).message))
            }>Disconnect</PrimaryButton>)
            : 
            (<PrimaryButton onClick={() =>
                connect().catch((e) => toast.error((e as Error).message))
            }>Connect</PrimaryButton>)
          }
          {address && (
            <div className="text-gray-600">
              <div>Wallet Information</div>
              <div>Network: {network.name}</div>
              <div>Address: {truncateAddress(address)}</div>
              <div>Celo: {Web3.utils.fromWei(summary.celo.toFixed())}</div>
              <div>cUSD: {Web3.utils.fromWei(summary.cusd.toFixed())}</div>
            </div>
          )}
      </main>
    </div>
  )
}
