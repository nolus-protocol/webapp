const months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
const sec = 1000;
const min = 60 * sec;
const hour = min * 60
const day = hour * 24;
const days = 30 * day;

const one_s = 'a second';
const many_s = 'seconds';

const one_m = 'a minute';
const many_m = 'minutes';

const one_h = 'an hour';
const many_h = 'hours';

const one_d = 'a day';
const many_d = 'days';

export function datePraser(dateTime: string) {

    const time = new Date(dateTime);
    const currentDate = new Date();
    const diff = time.getTime() - currentDate.getTime();

    if (diff < 0) {
        return one_s;
    }

    if (diff < min) {
        const time = Math.floor(diff / sec);
        if (time <= 1) {
            return one_s;
        }
        return `${time} ${many_s}`;
    }

    if (diff < hour) {
        const time = Math.floor(diff / min);
        if (time <= 1) {
            return one_m;
        }
        return `${time} ${many_m}`;
    }

    if (diff < day) {
        const time = Math.floor(diff / hour);
        if (time <= 1) {
            return one_h;
        }
        return `${time} ${many_h}`;
    }

    if (diff < days) {
        const time = Math.floor(diff / day);
        if (time <= 1) {
            return one_d;
        }
        return `${time} ${many_d}`;
    }

    const m = months[time.getMonth()];
    const date = `${time.getDate()}`
    const year = time.getFullYear();

    return `${m} ${date}, ${year}`;
}
