/* eslint-disable  @typescript-eslint/no-explicit-any */
import {ConnectionType} from "./definitions";
import {PublicConnection} from './public-connection'
import jwtDecode from "jwt-decode";
import mem from "mem";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

let requestId = 0;

export default class ConnectionCore {
    axiosInstance: ConnectionType = {} as any;
    accessToken: string | undefined;
    refreshToken: string | undefined;
    user: any;

    constructor(private baseUrl: string, private readonly onUserChange: (user: any) => void, private profile: string, private getUserId:(user: any) => string | undefined, private logNetwork: boolean = false) {
        this.onUserChange = onUserChange;
        console.log('Connection Core Constructor');
        this.init().then()
    }

    async init() {
        const axiosPublic = PublicConnection.init(this.baseUrl);
        const axiosPrivate = PublicConnection.init(this.baseUrl);
        const setTokens = async (accessToken: string, refreshToken: string) => {
            const refreshDecoded: any = jwtDecode(refreshToken);
            // const accessDecoded: any = jwtDecode(accessToken);
            this.accessToken = accessToken;
            const user: any = refreshDecoded.user;
            this.profile = this.getUserId(user) ?? 'default';
            this.user = user;
            this.onUserChange(this.user);
            console.log('USER', refreshDecoded, user);
            await AsyncStorage.setItem(`@auth-session/${this.profile}`, JSON.stringify({accessToken, refreshToken}))
            return user;
        };

        const refreshTokenFn = async (profile: string) => {
            const value = await AsyncStorage.getItem(`@auth-session/${profile}`);
            if (!value) {
                return undefined;
            }
            const currentRefreshToken = JSON.parse(value).refreshToken;
            try {
                const response = await axiosPublic.post('/auth/refresh-token', {
                    refreshToken: currentRefreshToken,
                });
                if (this.logNetwork) {
                  console.log('Refreshing token');
                }

                const {refreshToken, accessToken} = response.data;

                if (!accessToken) {
                    await AsyncStorage.removeItem(`@auth-session/${profile}`);
                    this.accessToken = undefined;
                    this.refreshToken = undefined;
                    this.user = undefined;
                    this.onUserChange?.(this.user);
                    return {refreshToken: undefined, accessToken: undefined};
                }
                console.log('Setting token when refresh...');
                setTokens(accessToken, refreshToken);

                return {refreshToken, accessToken};
            } catch (error: any) {
                if (this.logNetwork) {
                  console.log('Refresh token error', error?.status, JSON.stringify(error?.data));
                }
                await AsyncStorage.removeItem(`@auth-session/${profile}`);
                this.accessToken = undefined;
                this.refreshToken = undefined;
                this.user = undefined;
                this.onUserChange?.(this.user);
                return {refreshToken: undefined, accessToken: undefined};
            }
        };

        const maxAge = 10000;

        const memoizedRefreshToken = mem(refreshTokenFn, {
            maxAge,
        });

        axiosPrivate.interceptors.request.use(
            async (config) => {
                 requestId += 1;
                 (config as any).requestId = requestId;
                let accessToken = this.accessToken;
                if (this.logNetwork) {
                  console.log(`[${requestId}] ${config.method?.toUpperCase()} ${config.url} ${config.params ? JSON.stringify(config.params) : ''} ${config.data ? JSON.stringify(config.data) : ''}`);
                }
                if (!accessToken) {
                    const value = await AsyncStorage.getItem(`@auth-session/${this.profile}`);
                    if (!value) {
                        return config;
                    }
                    const refreshToken = JSON.parse(value).refreshToken;
                    if (!refreshToken) {
                        return config;
                    }

                    const result = await memoizedRefreshToken(this.profile);
                    accessToken = result?.accessToken;
                }

                if (!accessToken) {
                    return config;
                }

                config.headers.set('authorization', `Bearer ${accessToken}`);

                return config;
            },
            (error) => Promise.reject(error),
        );

        axiosPrivate.interceptors.response.use(
            (response) => {
              if (this.logNetwork) {
                console.log(`[${(response.config as any).requestId}] ${response.status} ${JSON.stringify(response.data)}`);
              }
                // console.log(
                //   'Received Resp',
                //   response?.headers,
                //   response?.headers['x-refresh-token'] === 'true',
                // );
                if (response?.headers['x-refresh-token'] === 'true') {
                    refreshTokenFn(this.profile).then();
                }
                return response;
            },
            async (error) => {
                const config = error?.config;

                if (error?.response?.status === 401 && !config?.sent) {
                    if (this.logNetwork) {
                      console.log(`[${(error.config as any).requestId}] ${error.status} ${JSON.stringify(error.data)}`);
                    }
                    config.sent = true;

                    const result = await memoizedRefreshToken(this.profile);

                    if (result?.accessToken) {
                        config.headers = {
                            ...config.headers,
                            authorization: `Bearer ${result?.accessToken}`,
                        };
                    }
                    try {
                      const resp =await axios(config);
                      if (this.logNetwork) {
                        console.log(`[${(error.config as any).requestId}] ${resp.status} ${JSON.stringify(resp.data)}`);
                      }
                      return resp;
                    } catch (e: any) {
                      if (this.logNetwork) {
                        console.log(`[${(error.config as any).requestId}] ${e.status} ${JSON.stringify(e.data)}`);
                      }
                      return Promise.reject(e);
                    }

                }
                if (this.logNetwork) {
                  console.log(`[${(error.config as any).requestId}] ${error.response?.status} ${JSON.stringify(error.response?.data)}`);
                }
                return Promise.reject(error);
            },
        );

        const conn: ConnectionType = axiosPrivate as any;
        conn.login = setTokens;
        conn.logout = async () => {
            await AsyncStorage.removeItem(`@auth-session/${this.profile}`);
            this.accessToken = undefined;
            this.refreshToken = undefined;
            this.user = undefined;
            this.onUserChange?.(this.user);
        };

        this.axiosInstance = conn;
        const value = await AsyncStorage.getItem(`@auth-session/${this.profile}`);
        if (value) {
            const tokens = JSON.parse(value);
            console.log('Setting token on init...');
            return await setTokens(tokens.accessToken, tokens.refreshToken);
        }
        this.onUserChange(undefined);
        return undefined;
    }
}
