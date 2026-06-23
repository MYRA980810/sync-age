import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MessageTypes, MessageDirections } from '../src/websocket/ws-protocol.js';

describe('MessageTypes', () => {
  it('defines exactly 12 message types', () => {
    assert.equal(Object.keys(MessageTypes).length, 12);
  });

  it('has all required message type constants', () => {
    const expected = [
      'AGENT_CONNECT', 'STOCK_UPDATE', 'PRODUCT_SYNC', 'SALE_RECORDED',
      'ONLINE_SALE', 'STOCK_REQUEST', 'STOCK_RESPONSE', 'SYNC_STATUS',
      'CONFIG_UPDATE', 'NEW_PRODUCT', 'PRODUCT_CREATED', 'DELETE_PRODUCT'
    ];

    for (const type of expected) {
      assert.equal(MessageTypes[type], type, `MessageTypes.${type} should equal "${type}"`);
    }
  });
});

describe('MessageDirections', () => {
  it('Server-to-Agent types are correct', () => {
    const serverToAgent = ['ONLINE_SALE', 'STOCK_REQUEST', 'CONFIG_UPDATE', 'NEW_PRODUCT', 'DELETE_PRODUCT'];

    for (const type of serverToAgent) {
      assert.equal(MessageDirections[type], 'SERVER_TO_AGENT', `${type} should be SERVER_TO_AGENT`);
    }
  });

  it('Agent-to-Server types are correct', () => {
    const agentToServer = [
      'AGENT_CONNECT', 'STOCK_UPDATE', 'PRODUCT_SYNC', 'SALE_RECORDED',
      'STOCK_RESPONSE', 'SYNC_STATUS', 'PRODUCT_CREATED'
    ];

    for (const type of agentToServer) {
      assert.equal(MessageDirections[type], 'AGENT_TO_SERVER', `${type} should be AGENT_TO_SERVER`);
    }
  });

  it('every MessageType has a direction defined', () => {
    for (const type of Object.keys(MessageTypes)) {
      assert.ok(MessageDirections[type], `Missing direction for ${type}`);
    }
  });
});
