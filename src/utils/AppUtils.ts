enum Mode {
    dev = 'dev',
    prod = 'prod'
}
export class ApptUtils {

    static isDev(){
        return import.meta.env.VITE_MODE == Mode.dev;
    }

}