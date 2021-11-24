import React, { useCallback, useEffect, useState } from 'react';
import { BigNumber } from 'bignumber.js';
import { useContractKit } from '@celo-tools/use-contractkit';
import Web3 from 'web3';
import hawalaJson from '../truffle/build/contracts/HawalaCoin.json';
import Head from 'next/head';
import { ContractButton, PrimaryButton } from '../components/buttons';
import { toast } from '../components';

const defaultSummary = {
  name: '',
  address: '',
  wallet: '',
  celo: new BigNumber(0),
};
const defaultGasPrice = 500000000000;
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
  const [transacting, setTransacting] = useState(false);
  const [role, setRole] = useState(0);
  const [balances, setBalances] = useState([]);

  // TODO right now making token and mission global, eventually they should be selectable
  const [tokenId, setTokenId] = useState(0);
  const [missionId, setMissionId] = useState(0);

  // TODO Move these to configs
  // Alfajores
  const hawalaAddress = '0x1c1835707FB45Fe1996b8E1c74873764eb99b743';
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

    const [accounts, goldToken] = await Promise.all([
      kit.contracts.getAccounts(),
      kit.contracts.getGoldToken(),
    ]);
    const [summary, celo] = await Promise.all([
      accounts.getAccountSummary(address).catch((e) => {
        console.error(e);
        return defaultSummary;
      }),
      goldToken.balanceOf(address)
    ]);
    await fetchTokenBalances();
    setSummary({
      ...summary,
      celo
    });
  }, [address, kit]);

  /**
   * Gets the balance of the latest token
   * TODO eventually this should support all tokens with a way to select which one
   */
  async function fetchTokenBalances(): Promise<void> {
    if (!address) {
      setBalances([]);
      return;
    }
    const tokenId = await hawalaContract.methods.currentTokenId().call();
    setTokenId(tokenId);
    const missionId = await hawalaContract.methods.currentMissionId().call();
    setMissionId(missionId);
    const balances = await hawalaContract.methods.balanceOfBatch([address], [0]).call();
    setBalances(balances);
  }

  /**
   * Calls the HawalaCoin contract to get the role assigned to the current address
   */
  async function fetchRole() {
    if (!address) {
      setRole(0);
      return;
    }
    const role = await hawalaContract.methods.users(address).call();
    console.log(role);
    setRole(parseInt(role, 10));
  }

  /**
   * Wrapper function for contract calls to handle the transacting flag and errors
   */
  async function wrapContractCall(fn: (...args: any) => Promise<void>, ...args: any) {
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
   * Adds a new role:
   * 0 - None
   * 1 - Donor
   * 2 - Client
   * 3 - CSO
   * 4 - Agent
   */
  async function addRole(inputAddress: string, role: number): Promise<void> {
    const txObject = await hawalaContract.methods.addUser(inputAddress, role); 
    let tx = await kit.sendTransactionObject(txObject, { from: kit.defaultAccount, gasPrice: defaultGasPrice });
    let receipt = await tx.waitReceipt();
    console.log(receipt);
  }

  /** 
   * Mints new tokens which are tied to a specific client which will be able to redeem/burn them
   */
  async function mint(clientAddress: string, amount: number): Promise<void> {
    const txObject = await hawalaContract.methods.mint(kit.defaultAccount, clientAddress, amount);
    let tx = await kit.sendTransactionObject(txObject, { from: kit.defaultAccount, gasPrice: defaultGasPrice });
    let receipt = await tx.waitReceipt();
    console.log(receipt);
    fetchSummary();
  }

  /** 
   * Calls the safeTransfer function on the ERC-1155 contract to transfer an amount of tokens to another address
   */
  async function transfer(targetAddress: string, tokenId: number, amount: number): Promise<void> {
    const txObject = await hawalaContract.methods.safeTransferFrom(kit.defaultAccount, targetAddress, tokenId, amount, []);
    let tx = await kit.sendTransactionObject(txObject, { from: kit.defaultAccount, gasPrice: defaultGasPrice });
    let receipt = await tx.waitReceipt();
    console.log(receipt);
    fetchSummary();
  }

  /** 
   * 
   */
  async function setApprovalForAll(): Promise<void> {
    const txObject = await hawalaContract.methods.setApprovalForAll(hawalaAddress, true);
    let tx = await kit.sendTransactionObject(txObject, { from: kit.defaultAccount, gasPrice: defaultGasPrice });
    let receipt = await tx.waitReceipt();
    console.log(receipt);
    fetchSummary();
  }

  /** 
   * 
   */
  async function createMission(targetAddress: string, tokenId: number, amount: number): Promise<void> {
    const txObject = await hawalaContract.methods.createMission(kit.defaultAccount, targetAddress, tokenId, amount);
    let tx = await kit.sendTransactionObject(txObject, { from: kit.defaultAccount, gasPrice: defaultGasPrice });
    let receipt = await tx.waitReceipt();
    console.log(receipt);
    fetchSummary();
  }

  /** 
   * 
   */
  async function completeMission(targetAddress: string, missionId: number): Promise<void> {
    const txObject = await hawalaContract.methods.completeMission(kit.defaultAccount, missionId);
    let tx = await kit.sendTransactionObject(txObject, { from: kit.defaultAccount, gasPrice: defaultGasPrice });
    let receipt = await tx.waitReceipt();
    console.log(receipt);
    fetchSummary();
  }
  /**
   * Burns a number of tokens, done by the client in response to the Agent collecting money
   */
  async function burn(tokenId: number, amount: number) {
    const txObject = await hawalaContract.methods.burn(kit.defaultAccount, tokenId, amount);
    let tx = await kit.sendTransactionObject(txObject, { from: kit.defaultAccount, gasPrice: defaultGasPrice });
    let receipt = await tx.waitReceipt();
    console.log(receipt);
    fetchSummary();
  }

  function RoleView() {
    switch(role) {
      case 0:
        return (<div>{UnassignedView()}</div>);
      case 1:
        return (<div>{DonorView()}</div>);
      case 2:
        return (<div>{ClientView()}</div>);
      case 3:
        return (<div>{CsoView()}</div>);
      case 4:
        return (<div>{AgentView()}</div>);
      default:
        return (<div>{UnassignedView()}</div>);
    }
  }

  const [clientAddress, setClientAddress] = useState('');
  const [mintAmount, setMintAmount] = useState(100);
  const [csoAddress, setCsoAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState(100);

  function DonorView() {
    return (
      <div className="flex flex-col">
        <div className="msg-bubble">Welcome Donor</div>
        <div className="msg-bubble">Add the address of the Client you will send USD to</div>
        <div>
          <input className="msg-input w-96" type="text" placeholder="Client Address" value={clientAddress} onChange={(event: any) => {
            setClientAddress(event.target.value);
          }}></input>
        </div>
        <ContractButton className="float-right" disabled={transacting} onClick={() => wrapContractCall(() => addRole(clientAddress, 2))} children="Add Client" />
        <div className="msg-bubble">Transfer USD to the Client</div>
        <div className="msg-bubble">Once transferred you can mint representative tokens</div>
        <div>
          <input className="msg-input" type="text" placeholder="Amount in cents" value={mintAmount} onChange={(event: any) => {
            setMintAmount(event.target.value);
          }}></input>
        </div>
        <ContractButton className="float-right" disabled={transacting} onClick={() => wrapContractCall(() => mint(clientAddress, mintAmount))} children="Mint Tokens" />
        <div className="msg-bubble">Add the address of the CSO who will receive the tokens</div>
        <div>
          <input className="msg-input w-96" type="text" placeholder="CSO Address" value={csoAddress} onChange={(event: any) => {
            setCsoAddress(event.target.value);
          }}></input>
        </div>
        <ContractButton className="float-right" disabled={transacting} onClick={() => wrapContractCall(() => addRole(csoAddress, 3))} children="Add CSO" />
        <div className="msg-bubble">Transfer tokens to CSO</div>
        <div>
          <input className="msg-input" type="text" placeholder="Amount in cents" value={transferAmount} onChange={(event: any) => {
            setTransferAmount(event.target.value);
          }}></input>
        </div>
        <ContractButton className="float-right" disabled={transacting} onClick={() => wrapContractCall(() => transfer(csoAddress, tokenId, transferAmount))} children="Transfer to CSO" />
      </div>
    );
  }

  const [agentAddress, setAgentAddress] = useState('');
  const [missionAmount, setMissionAmountAddress] = useState(100);

  function CsoView() {
    return (
      <div className="flex flex-col">
        <div className="msg-bubble">Welcome CSO</div>
        <ContractButton className="float-right w-52" disabled={transacting} onClick={() => wrapContractCall(() => setApprovalForAll())} children="Approve Contract" />
        <div className="msg-bubble">Create a mission for an Agent</div>
        <div className="msg-bubble">Choose an Agent and amount to assign</div>
        <div>
          <input className="msg-input w-96 float-right" type="text" placeholder="Agent Address" value={agentAddress} onChange={(event: any) => {
            setAgentAddress(event.target.value);
          }}></input>
        </div>
        <div>
          <input className="msg-input float-right" type="text" placeholder="Mission Amount" value={missionAmount} onChange={(event: any) => {
            setMissionAmountAddress(event.target.value);
          }}></input>
        </div>
        <ContractButton className="float-right" disabled={transacting} onClick={() => wrapContractCall(() => createMission(agentAddress, tokenId, missionAmount))} children="Create Mission" />
      </div>
    );
  }

  function AgentView() {
    return (
      <div className="flex flex-col">
        <div className="msg-bubble">Welcome Agent</div>
      </div>
    );
  }

  function ClientView() {
    return (
      <div className="flex flex-col">
        <div className="msg-bubble">Welcome Client</div>
        <div>
          <input className="msg-input w-96" type="text" placeholder="Agent Address" value={agentAddress} onChange={(event: any) => {
            setAgentAddress(event.target.value);
          }}></input>
        </div>
        <ContractButton className="float-right" disabled={transacting} onClick={() => wrapContractCall(() => addRole(agentAddress, 4))} children="Add Agent" />
      </div>
    );
  }

  function UnassignedView() {
    return (
      <div className="flex flex-col">
        <div className="msg-bubble">Your address doesn't have a role assigned</div>
      </div>
    );
  }

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    void fetchRole();
  }, [fetchRole]);

  return (
    <div>
      <Head>
        <title>HawalaCoin</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="fixed w-full bg-indigo-900 h-12 pt-2 text-white text-center font-bold text-lg tracking-wide" onClick={() => { fetchSummary(); fetchRole(); }}>
        Hawala Coin
      </div>
      <main className="max-w-screen-sm mx-auto py-10 px-4">
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
            <div>
              <div className="msg-bubble">
                <div>Wallet Information</div>
                <div>Network: {network.name}</div>
                <div>Address: {truncateAddress(address)}</div>
                <div>Celo: {Web3.utils.fromWei(summary.celo.toFixed())}</div>
                {balances.map((balance, tokenId) =>
                  <div key={tokenId}>Token{tokenId} Balance: {balance}</div>
                )}
              </div>
              <div>
                {RoleView()}
              </div>
            </div>
          )}
      </main>
    </div>
  )
}
