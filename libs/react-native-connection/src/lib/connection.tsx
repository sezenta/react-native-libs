/* eslint-disable  @typescript-eslint/no-explicit-any */
'use client';
import React, {FC, PropsWithChildren, useCallback, useContext, useMemo, useState,} from 'react';
import {ConnectionData, ConnectionType} from "./definitions";
import ConnectionCore from "./ConnectionCore";

export const Connection = React.createContext<ConnectionData>({} as any);

type ConnectionProviderProps = {
    baseUrl: string;
    profile?: string;
    userId: (user: any) => string | undefined;
};
export const ConnectionProvider: FC<
    PropsWithChildren<ConnectionProviderProps>
> = (props) => {
    const [user, setUser] = useState<any>();
    const [connection, setConnection] = useState<ConnectionCore>(new ConnectionCore(props.baseUrl, setUser, props.profile ?? 'default', props.userId));

    const setProfile = useCallback(async (profile: string): Promise<ConnectionType> => {
        const conn = new ConnectionCore(props.baseUrl, setUser, profile, props.userId)
        setConnection(conn)
        return conn.axiosInstance;
    }, [props.baseUrl, props.userId]);

    const val = useMemo(() => ({axiosInstance: connection.axiosInstance, user, setProfile}), [connection, setProfile, user]);
    return (
        <Connection.Provider value={val}>{props.children}</Connection.Provider>
    );
};

export const useConnection = () => {
    return useContext(Connection).axiosInstance;
};

export const useUser = <T = any>(): T | undefined => {
    return useContext(Connection).user;
};
