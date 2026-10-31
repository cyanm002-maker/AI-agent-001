import { supabase } from "../lib/supabase";

export const signInWithGithub = async () => {
    const {data,error} = await supabase.auth.signInWithOAuth({
        provider:"github",
        options:{
            redirectTo:window.location.origin
        }
    });

    if(error){
        throw error;
    }
    
    return data;
};

export const signOut = async () => {
    const {error} = await supabase.auth.signOut();

    if(error){
        throw error;
    }
};