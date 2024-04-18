import { i18n } from "@/i18n";

function getParams() {
  const months = [
    i18n.global.t("message.jan"),
    i18n.global.t("message.feb"),
    i18n.global.t("message.mar"),
    i18n.global.t("message.april"),
    i18n.global.t("message.may"),
    i18n.global.t("message.jun"),
    i18n.global.t("message.jul"),
    i18n.global.t("message.aug"),
    i18n.global.t("message.sep"),
    i18n.global.t("message.oct"),
    i18n.global.t("message.nov"),
    i18n.global.t("message.dec")
  ];

  const sec = 1000;
  const min = 60 * sec;
  const hour = min * 60;
  const day = hour * 24;
  const days = 30 * day;

  const one_s = i18n.global.t("message.one_s");
  const many_s = i18n.global.t("message.many_s");

  const one_m = i18n.global.t("message.one_m");
  const many_m = i18n.global.t("message.many_m");

  const one_h = i18n.global.t("message.one_h");
  const many_h = i18n.global.t("message.many_h");

  const one_d = "a day";
  const many_d = "days";

  return {
    months,
    sec,
    min,
    hour,
    day,
    days,
    one_s,
    many_s,
    one_m,
    many_m,
    one_h,
    many_h,
    one_d,
    many_d
  };
}

export function datePraser(dateTime: string) {
  const { months, sec, min, hour, day, days, one_s, many_s, one_m, many_m, one_h, many_h, one_d, many_d } = getParams();

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
  const date = `${time.getDate()}`;
  const year = time.getFullYear();

  return `${m} ${date}, ${year}`;
}

export function getCreatedAtForHuman(createdAt: Date | null) {
  const { months, sec, min, hour, day, one_s, many_s, one_m, many_m, one_h, many_h } = getParams();

  if (createdAt == null) {
    return null;
  }

  let currentDate = new Date();
  let diff = currentDate.getTime() - (createdAt as Date).getTime();

  if (diff < 0) {
    return one_s;
  }

  if (diff < min) {
    let time = Math.floor(diff / sec);
    if (time <= 1) {
      return one_s;
    }
    return `${time} ${many_s}`;
  }
  if (diff < hour) {
    let time = Math.floor(diff / min);
    if (time <= 1) {
      return one_m;
    }
    return `${time} ${many_m}`;
  }

  if (diff < day) {
    let time = Math.floor(diff / hour);
    if (time <= 1) {
      return one_h;
    }
    return `${time} ${many_h}`;
  }

  const m = months[(createdAt as Date).getMonth()];
  const date = `${(createdAt as Date).getDate()}`;
  const year = (createdAt as Date).getFullYear();

  return `${m} ${date}, ${year}`;
}

export function formatDateTime(dateTime: string | null) {
  if (dateTime === null) {
    return false;
  }

  const time = new Date(dateTime);
  const { months } = getParams();

  const m = months[time.getMonth()];
  const date = `${time.getDate()}`;
  const year = time.getFullYear();
  const timeString = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return `${m} ${date}, ${year} ${timeString}`;
}
