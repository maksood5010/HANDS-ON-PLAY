import { jest } from "@jest/globals";

export const buildReq = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: {
    id: 1,
    company_id: 10,
    company_slug: "acme",
    role: "company_admin",
  },
  ...overrides,
});

export const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
