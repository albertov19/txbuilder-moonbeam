import React, { useState, useEffect } from 'react';
import { Container, Input, Button, Label, Form, Message } from 'semantic-ui-react';
import { subProvider } from '../web3/api';
import * as ethers from 'ethers';

const StakingBuilder = ({ network }) => {
  const [stkAddress, setStkAddress] = useState('');
  const [colAddress, setColAddress] = useState('');
  const [amount, setAmount] = useState(BigInt(0));
  const [autoCompound, setAutoCompound] = useState(BigInt(0));
  const [stakingCall, setStakingCall] = useState({
    targetNetwork: '',
    stkAddress: '',
    colAddress: '',
    amount: BigInt(0),
    autoCompound: BigInt(0),
    candidateDelegationCount: BigInt(0),
    candidateAutoCompoundingDelegationCount: BigInt(0),
    delegationCount: BigInt(0),
    tokenLabel: '',
  });

  const [stakingCallData, setStakingCallData] = useState('');
  const [proxyCallData, setProxyCallData] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [tokenLabel, setTokenLabel] = useState(network.token);
  const [URL, setURL] = useState(network.url);

  useEffect(() => {
    setTokenLabel(network.token);
  }, []);

  const calculate = async () => {
    setErrorMessage('');

    // Load Provider
    const api = await subProvider(network.value);
    setTokenLabel(network.token);
    setURL(network.url);

    //Check Input
    // Staking Address
    let check = ethers.utils.isAddress(stkAddress);
    if (!check) {
      setErrorMessage('Address with funds not valid!');
      return;
    }

    // Collator Address
    check = ethers.utils.isAddress(colAddress);
    if (!check) {
      setErrorMessage('Collator address not valid!');
      return;
    }

    // Balance
    let balance = ((await api.query.system.account(stkAddress)) as any).toHuman().data;
    check =
      BigInt(balance.free.replaceAll(',', '')) -
        BigInt(balance.miscFrozen.replaceAll(',', '')) -
        BigInt(100000000000000000) >
      BigInt(amount);
    if (!check) {
      setErrorMessage('Not enough balance!');
      return;
    }

    // AutoCompound Value between 0-100
    check = autoCompound >= 0 ? (autoCompound <= 100 ? true : false) : false;
    if (!check) {
      setErrorMessage('AutoCompound must be between 0 and 100!');
      return;
    }

    // Check if Candidate is Collator
    const candidatePool = ((await api.query.parachainStaking.candidatePool()) as any).toHuman();
    let isCandidate;
    candidatePool.map((candidate) => {
      if (colAddress === candidate.owner) {
        isCandidate = true;
      }
    });

    // Get Candidate Delegation Count
    let candidateDelegationCount;
    if (isCandidate) {
      candidateDelegationCount = BigInt(
        ((await api.query.parachainStaking.candidateInfo(colAddress)) as any).toHuman().delegationCount
      );
    } else {
      setErrorMessage('Collator is not a candidate in this network!');
      return;
    }

    // Get Candidate Auto-Compounding Delegation Count
    const candidateAutoCompoundingDelegationCount = BigInt(
      ((await api.query.parachainStaking.autoCompoundingDelegations(colAddress)) as any).toHuman().length
    );

    // Get Your Delegations Count
    let delegationCount;
    const delegatorInfo = await api.query.parachainStaking.delegatorState(stkAddress);

    if (delegatorInfo.toHuman()) {
      delegationCount = BigInt(delegatorInfo.toHuman()['delegations'].length);
    } else {
      delegationCount = BigInt(0);
    }

    // Create Staking Call
    const stakingCall = await api.tx.parachainStaking.delegateWithAutoCompound(
      colAddress,
      amount,
      autoCompound,
      candidateDelegationCount + BigInt(10),
      candidateAutoCompoundingDelegationCount + BigInt(10),
      delegationCount + BigInt(10)
    );

    setStakingCallData(stakingCall.method.toHex());

    // Generate Proxy call
    const proxyCall = await api.tx.proxy.proxy(stkAddress, null, stakingCall);

    setProxyCallData(proxyCall.method.toHex());

    // Set Calculated Data
    setStakingCall({
      targetNetwork: network.key,
      colAddress,
      stkAddress,
      amount,
      autoCompound,
      candidateDelegationCount,
      candidateAutoCompoundingDelegationCount,
      delegationCount,
      tokenLabel,
    });
  };

  const checkAddress = (account) => {
    if (ethers.utils.isAddress(account)) {
      return ethers.utils.getAddress(account);
    } else {
      return account;
    }
  };

  return (
    <Container>
      <div style={{ width: '50%' }}>
        <h3>Staking Transaction</h3>
        <Input
          fluid
          label={{ content: 'Account with Funds:' }}
          placeholder='Address with the tokens...'
          onChange={(input) => {
            let address = checkAddress(input.target.value);
            setStkAddress(address);
          }}
        />
        <br />
        <Input
          fluid
          label={{ content: 'Enter Collator Address:' }}
          placeholder='Collator you want to stake...'
          onChange={(input) => {
            let address = checkAddress(input.target.value);
            setColAddress(address);
          }}
        />
        <br />

        <Input
          fluid
          labelPosition='right'
          type='text'
          placeholder='Amount of tokens...'
          onChange={(input) => {
            let amount;
            if (input.target.value) {
              amount = ethers.utils.parseEther(input.target.value.toString()).toString();
            }
            setAmount(amount);
          }}
        >
          <Label>Enter Staking Amount:</Label>
          <input />
          <Label>{tokenLabel}</Label>
        </Input>
        <br />

        <Input
          fluid
          labelPosition='right'
          type='text'
          placeholder='AutoCompound percentage...'
          onChange={(input) => setAutoCompound(BigInt(Math.round(Number(input.target.value))))}
        >
          <Label>Enter AutoCompound Percent:</Label>
          <input />
          <Label>%</Label>
        </Input>
      </div>
      <br />
      <Form onSubmit={() => calculate()} error={!!errorMessage}>
        <Button type='submit' disabled={!stkAddress || !colAddress || !amount || !autoCompound} color='orange'>
          Calculate Data
        </Button>
        <Message style={{ width: '50%' }} error header='Oops!' content={errorMessage} />
      </Form>
      <br />
      {stakingCallData && proxyCallData ? (
        <div>
          Staking Call URL:{' '}
          <a href={URL + '#/extrinsics/decode/' + stakingCallData} target='_blank'>
            {' '}
            Staking Polkadot.js Apps Moonbeam URL
          </a>
          <br />
          Proxy Call URL:{' '}
          <a href={URL + '#/extrinsics/decode/' + proxyCallData} target='_blank'>
            {' '}
            Proxy Polkadot.js Apps Moonbeam URL
          </a>
          <br />
          <ul>
            <li>{stakingCall.targetNetwork}</li>
            <li>Account with Funds: {stakingCall.stkAddress}</li>
            <li>Collator: {stakingCall.colAddress} </li>
            <li>
              Staking Amount: {ethers.utils.formatEther(stakingCall.amount)} {stakingCall.tokenLabel}
            </li>
            <li> Auto-Compound: {stakingCall.targetNetwork} </li>
            <li>Candidate Delegation Count: {stakingCall.candidateDelegationCount.toString()}</li>
            <li>
              Candidate AutoCompound Delegation Count: {stakingCall.candidateAutoCompoundingDelegationCount.toString()}
            </li>
            <li>Delegation Count: {stakingCall.delegationCount.toString()}</li>
          </ul>
        </div>
      ) : (
        ''
      )}
    </Container>
  );
};

export default StakingBuilder;
