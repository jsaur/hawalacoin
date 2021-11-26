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
const defaultGasPrice = 1000000000000;
const ERC20_DECIMALS = 18;

function truncateAddress(address: string) {
  if (!address) {
    return '';
  }
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
  const hawalaAddress = '0xfc209B1c15330E2307E065C6e0D1eDFF422ba494';
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
    // We want to set the most recent token and mission, which is the current - 1
    let tokenId = await hawalaContract.methods.currentTokenId().call();
    tokenId = tokenId === 0 ? 0 : tokenId - 1;
    setTokenId(tokenId);
    let missionId = await hawalaContract.methods.currentMissionId().call();
    missionId = missionId === 0 ? 0 : missionId - 1;
    setMissionId(missionId);
    const balances = await hawalaContract.methods.balanceOfBatch([address], [tokenId]).call();
    setBalances(balances);
    console.log(`token ${tokenId}`);
    console.log(`mission ${missionId}`);
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
    console.log(`${kit.defaultAccount} ${targetAddress} ${tokenId} ${amount}`);
    const txObject = await hawalaContract.methods.createMission(kit.defaultAccount, targetAddress, tokenId, amount);
    let tx = await kit.sendTransactionObject(txObject, { from: kit.defaultAccount, gasPrice: defaultGasPrice });
    let receipt = await tx.waitReceipt();
    console.log(receipt);
    fetchSummary();
  }

  const [mission, setMission] = useState({});

  /** 
   * 
   */
  async function fetchMission(missionId: number): Promise<void> {
    const mission = await hawalaContract.methods.missions(missionId).call();
    setMission(mission);
  }

  /** 
   * 
   */
  async function completeMission(missionId: number): Promise<void> {
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
  const [mintAmount, setMintAmount] = useState(null);
  const [csoAddress, setCsoAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState(null);

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
          <input className="msg-input" type="text" placeholder="Mint Amount" value={mintAmount} onChange={(event: any) => {
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
          <input className="msg-input" type="text" placeholder="Transfer Amount" value={transferAmount} onChange={(event: any) => {
            setTransferAmount(event.target.value);
          }}></input>
        </div>
        <ContractButton className="float-right" disabled={transacting} onClick={() => wrapContractCall(() => transfer(csoAddress, tokenId, transferAmount))} children="Transfer to CSO" />
      </div>
    );
  }

  const [agentAddress, setAgentAddress] = useState('');
  const [missionAmount, setMissionAmount] = useState(null);

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
            setMissionAmount(event.target.value);
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
        <ContractButton className="float-right" disabled={transacting} onClick={() => wrapContractCall(() => fetchMission(missionId))} children="Fetch Mission" />
        <div className="msg-bubble">
          <div>Mission details: </div>
          <div>CSO Addr: {truncateAddress(mission.csoAddr)}</div>
          <div>Amount: {mission.amount}</div>
        </div>
        <div className="msg-bubble">Complete the mission by delivering cash to the CSO</div>
        <div className="msg-bubble">You will be rewarded in tokens</div>
        <ContractButton className="float-right w-48" disabled={transacting} onClick={() => wrapContractCall(() => completeMission(missionId))} children="Complete Mission" />
        <div className="msg-bubble">Transfer tokens to Client to cash out</div>
        <div>
          <input className="msg-input w-96" type="text" placeholder="Client Address" value={clientAddress} onChange={(event: any) => {
            setClientAddress(event.target.value);
          }}></input>
        </div>
        <div>
          <input className="msg-input py-1" type="text" placeholder="Transfer Amount" value={transferAmount} onChange={(event: any) => {
            setTransferAmount(event.target.value);
          }}></input>
        </div>
        <ContractButton className="float-right w-48" disabled={transacting} onClick={() => wrapContractCall(() => transfer(clientAddress, tokenId, transferAmount))} children="Transfer to Client" />
      </div>
    );
  }

  const [burnAmount, setBurnAmount] = useState(null);

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
        <div className="msg-bubble">Wait for Agent to cash out</div>
        <div className="msg-bubble">One Agent has cashed out, burn the underlying tokens</div>
        <div className="msg-bubble">This completes the cycle</div>
        <div>
          <input className="msg-input" type="text" placeholder="Burn Amount" value={burnAmount} onChange={(event: any) => {
            setBurnAmount(event.target.value);
          }}></input>
        </div>
        <ContractButton className="float-right w-48" disabled={transacting} onClick={() => wrapContractCall(() => burn(tokenId, burnAmount))} children="Burn tokens" />
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
                {balances.map((balance) =>
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
