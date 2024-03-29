import React, { useState } from 'react';
import { Container, Menu, Dropdown } from 'semantic-ui-react';
import Head from 'next/head';
import Link from 'next/link';

import StakingBuilder from '../components/staking';

const networks = [
  {
    key: 'Moonbeam',
    text: 'Moonbeam',
    value: 'moonbeam',
    image: { avatar: true, src: 'moonbeam.png' },
    token: 'GLMR',
    url: 'wss://moonbeam.unitedbloc.com',
  },
  {
    key: 'Moonriver',
    text: 'Moonriver',
    value: 'moonriver',
    image: { avatar: true, src: 'moonriver.png' },
    token: 'MOVR',
    url: 'wss://moonriver.unitedbloc.com',
  },
  {
    key: 'Moonbase Alpha',
    text: 'Moonbase Alpha',
    value: 'moonbase',
    image: { avatar: true, src: 'moonbase.png' },
    token: 'DEV',
    url: 'wss://moonbase.unitedbloc.com',
  },
];

const TxBuilder = () => {
  const [network, setNetwork] = useState(networks[0]);

  const handleChange = (e, { value }) => {
    setNetwork(networks.find((network) => network.value === value));
  };

  return (
    <Container>
      <Head>
        <title>Transaction Builder</title>
        <link rel='icon' type='image/png' sizes='32x32' href='/favicon.png' />
        <link rel='stylesheet' href='//cdn.jsdelivr.net/npm/semantic-ui@2.4.2/dist/semantic.min.css' />
      </Head>
      <div style={{ paddingTop: '10px' }}>
        <Menu>
          <Link href='/'>
            <a className='item'>Transaction Builder</a>
          </Link>
          <Menu.Item position='right'>
            <Dropdown
              placeholder='Select Network'
              selection
              options={networks}
              onChange={handleChange}
              defaultValue={networks[0].value}
            />
          </Menu.Item>
        </Menu>
      </div>
      <br />
      <StakingBuilder network={network} />

      <p>
        Don't judge the code :) as it is for demostration purposes only. You can check the source code{' '}
        <a href='https://github.com/albertov19/GetStakingInfo-Moonbeam' target='_blank'>
          here
        </a>
      </p>
    </Container>
  );
};

export default TxBuilder;
