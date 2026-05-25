'use strict';

/**
 * items.dat Binary Reader/Writer
 * Supports all versions (v11-v26)
 */

class BinaryReader {
  constructor(buffer) {
    this.buf = buffer;
    this.pos = 0;
  }

  uint8() {
    const v = this.buf.readUInt8(this.pos);
    this.pos += 1;
    return v;
  }

  int8() {
    const v = this.buf.readInt8(this.pos);
    this.pos += 1;
    return v;
  }

  uint16() {
    const v = this.buf.readUInt16LE(this.pos);
    this.pos += 2;
    return v;
  }

  int16() {
    const v = this.buf.readInt16LE(this.pos);
    this.pos += 2;
    return v;
  }

  uint32() {
    const v = this.buf.readUInt32LE(this.pos);
    this.pos += 4;
    return v;
  }

  int32() {
    const v = this.buf.readInt32LE(this.pos);
    this.pos += 4;
    return v;
  }

  float32() {
    const v = this.buf.readFloatLE(this.pos);
    this.pos += 4;
    return v;
  }

  string() {
    const len = this.uint16();
    const str = this.buf.slice(this.pos, this.pos + len).toString('latin1');
    this.pos += len;
    return str;
  }

  bytes(n) {
    const b = this.buf.slice(this.pos, this.pos + n);
    this.pos += n;
    return b;
  }

  skip(n) {
    this.pos += n;
  }

  get remaining() {
    return this.buf.length - this.pos;
  }
}

class BinaryWriter {
  constructor() {
    this.chunks = [];
  }

  uint8(v) {
    const b = Buffer.alloc(1);
    b.writeUInt8(v & 0xFF);
    this.chunks.push(b);
  }

  int8(v) {
    const b = Buffer.alloc(1);
    b.writeInt8(v);
    this.chunks.push(b);
  }

  uint16(v) {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(v & 0xFFFF);
    this.chunks.push(b);
  }

  int16(v) {
    const b = Buffer.alloc(2);
    b.writeInt16LE(v);
    this.chunks.push(b);
  }

  uint32(v) {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(v >>> 0);
    this.chunks.push(b);
  }

  int32(v) {
    const b = Buffer.alloc(4);
    b.writeInt32LE(v);
    this.chunks.push(b);
  }

  float32(v) {
    const b = Buffer.alloc(4);
    b.writeFloatLE(v);
    this.chunks.push(b);
  }

  string(str) {
    const encoded = Buffer.from(str, 'latin1');
    this.uint16(encoded.length);
    this.chunks.push(encoded);
  }

  bytes(buf) {
    this.chunks.push(Buffer.from(buf));
  }

  toBuffer() {
    return Buffer.concat(this.chunks);
  }
}

// XOR cipher key for item names
const XOR_KEY = 'PBG892FXX982ABC*';

function cipherName(name, itemId) {
  const buf = Buffer.from(name, 'latin1');
  for (let i = 0; i < buf.length; i++) {
    buf[i] ^= XOR_KEY.charCodeAt((i + itemId) % 16);
  }
  return buf.toString('latin1');
}

// Hash function (same as Growtopia uses)
function hashData(buffer) {
  let acc = 0x55555555;
  for (let i = 0; i < buffer.length; i++) {
    acc = (((acc >>> 27) | (acc << 5)) + buffer[i]) >>> 0;
  }
  return acc;
}

module.exports = { BinaryReader, BinaryWriter, cipherName, hashData, XOR_KEY };
