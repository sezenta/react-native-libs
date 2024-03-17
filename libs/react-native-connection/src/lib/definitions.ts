/* eslint-disable  @typescript-eslint/no-explicit-any */
import {AxiosInstance} from "axios";

export type ConnectionType = AxiosInstance & {
    login: <T = any>(accessToken: string, refreshToken: string) => Promise<T>;
    logout: () => Promise<void>;
};

export type ConnectionData = {
    axiosInstance: ConnectionType;
    user?: any | null | undefined;
    setProfile: (profile: string) => Promise<ConnectionType>;
};
