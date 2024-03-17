'use client';
import axios, { AxiosInstance } from 'axios';

export class PublicConnection {
  static instance: AxiosInstance;

  static init(baseUrl: string) {
    PublicConnection.instance = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return PublicConnection.instance;
  }
}
