/**
 * Template Resmi Expert Advisor (EA) MQL5 `TrawanganMT5Bridge.mq5`
 *
 * Menjalankan jembatan lokal ringan di terminal MetaTrader 5 Desktop (Windows / Wine Linux / macOS)
 * agar `trawangan` dapat membaca saldo/posisi dan mengeksekusi order manual pada broker CFD mana pun
 * (Exness, HFM, Pepperstone, Octa, IC Markets, dll.) secara 100% gratis dan lokal tanpa cloud relay.
 */

export function generateMt5ExpertAdvisorSource(port = 15555, localToken = 'trawangan-mt5-local'): string {
  return `//+------------------------------------------------------------------+
//|                                         TrawanganMT5Bridge.mq5   |
//|        Jembatan Eksekusi Lokal Resmi untuk Terminal trawangan     |
//|                    https://github.com/KaleksananBarqi/trawangan  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026 Kaleksanan Barqi Aji Massani (Apache-2.0)"
#property link      "https://github.com/KaleksananBarqi/trawangan"
#property version   "1.00"
#property description "Localhost Execution Bridge for trawangan Manual Order Ticket (Zero Cloud Relay)."

#include <Trade\\Trade.mqh>

input string InpBridgeUrl   = "http://127.0.0.1:${port}"; // Local Bridge Endpoint
input string InpSecretToken = "${localToken}";            // Local Security Token (Match with trawangan Settings)
input int    InpPollMs      = 250;                        // Command Poll Interval (ms)
input ulong  InpMagicNumber = 20261124;                   // Magic Number for trawangan Manual Orders

CTrade ExtTrade;

int OnInit()
{
   ExtTrade.SetExpertMagicNumber(InpMagicNumber);
   EventSetMillisecondTimer(InpPollMs);
   Print("[trawangan MT5 Bridge] Active & ready for manual order commands. Magic=", InpMagicNumber);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("[trawangan MT5 Bridge] Stopped.");
}

string BuildAccountSnapshotJson()
{
   string currency = AccountInfoString(ACCOUNT_CURRENCY);
   string server   = AccountInfoString(ACCOUNT_SERVER);
   double balance  = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity   = AccountInfoDouble(ACCOUNT_EQUITY);
   double freeMgn  = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   long   leverage = AccountInfoInteger(ACCOUNT_LEVERAGE);

   string posJson = "[";
   int totalPos = PositionsTotal();
   bool firstPos = true;
   for(int i = 0; i < totalPos; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      string sym    = PositionGetString(POSITION_SYMBOL);
      long   ptype  = PositionGetInteger(POSITION_TYPE);
      string side   = (ptype == POSITION_TYPE_BUY) ? "BUY" : "SELL";
      double vol    = PositionGetDouble(POSITION_VOLUME);
      double openPx = PositionGetDouble(POSITION_PRICE_OPEN);
      double curPx  = PositionGetDouble(POSITION_PRICE_CURRENT);
      double pnl    = PositionGetDouble(POSITION_PROFIT);

      if(!firstPos) posJson += ",";
      firstPos = false;
      posJson += StringFormat(
         "{\\"symbol\\":\\"%s\\",\\"side\\":\\"%s\\",\\"size\\":%.4f,\\"entryPrice\\":%.5f,\\"markPrice\\":%.5f,\\"unrealizedPnl\\":%.2f,\\"leverage\\":\\"%I64dx\\"}",
         sym, side, vol, openPx, curPx, pnl, leverage
      );
   }
   posJson += "]";

   string ordJson = "[";
   int totalOrd = OrdersTotal();
   bool firstOrd = true;
   for(int i = 0; i < totalOrd; i++)
   {
      ulong ticket = OrderGetTicket(i);
      if(ticket == 0) continue;
      string sym     = OrderGetString(ORDER_SYMBOL);
      long   otype   = OrderGetInteger(ORDER_TYPE);
      string side    = (otype == ORDER_TYPE_BUY_LIMIT || otype == ORDER_TYPE_BUY_STOP) ? "BUY" : "SELL";
      string oType   = (otype == ORDER_TYPE_BUY_LIMIT || otype == ORDER_TYPE_SELL_LIMIT) ? "LIMIT" : "STOP";
      double price   = OrderGetDouble(ORDER_PRICE_OPEN);
      double vol     = OrderGetDouble(ORDER_VOLUME_CURRENT);

      if(!firstOrd) ordJson += ",";
      firstOrd = false;
      ordJson += StringFormat(
         "{\\"orderId\\":\\"%I64u\\",\\"symbol\\":\\"%s\\",\\"side\\":\\"%s\\",\\"orderType\\":\\"%s\\",\\"price\\":%.5f,\\"quantity\\":%.4f,\\"status\\":\\"OPEN\\"}",
         ticket, sym, side, oType, price, vol
      );
   }
   ordJson += "]";

   return StringFormat(
      "{\\"currency\\":\\"%s\\",\\"server\\":\\"%s\\",\\"balance\\":%.2f,\\"equity\\":%.2f,\\"freeMargin\\":%.2f,\\"positions\\":%s,\\"orders\\":%s}",
      currency, server, balance, equity, freeMgn, posJson, ordJson
   );
}

string ExtractJsonString(const string json, const string key)
{
   string pattern = "\\\\"" + key + "\\\\":\\\\"";
   int start = StringFind(json, pattern);
   if(start < 0) return "";
   start += StringLen(pattern);
   int end = StringFind(json, "\\\\"", start);
   if(end < 0) return "";
   return StringSubstr(json, start, end - start);
}

double ExtractJsonDouble(const string json, const string key)
{
   string pattern = "\\\\"" + key + "\\\\":";
   int start = StringFind(json, pattern);
   if(start < 0) return 0.0;
   start += StringLen(pattern);
   int endComma = StringFind(json, ",", start);
   int endBrace = StringFind(json, "}", start);
   int end = endComma;
   if(end < 0 || (endBrace >= 0 && endBrace < end)) end = endBrace;
   if(end < 0) end = StringLen(json);
   string raw = StringSubstr(json, start, end - start);
   StringTrimLeft(raw);
   StringTrimRight(raw);
   return StringToDouble(raw);
}

void ExecuteManualOrderFromJson(const string respText)
{
   string sym       = ExtractJsonString(respText, "symbol");
   string side      = ExtractJsonString(respText, "side");
   string orderType = ExtractJsonString(respText, "orderType");
   double volume    = ExtractJsonDouble(respText, "volume");
   double price     = ExtractJsonDouble(respText, "price");
   double sl        = ExtractJsonDouble(respText, "sl");
   double tp        = ExtractJsonDouble(respText, "tp");

   if(sym == "" || volume <= 0.0)
   {
      Print("[trawangan MT5 Bridge] Invalid ORDER payload: ", respText);
      return;
   }
   ExecuteManualOrder(sym, side, orderType, volume, price, sl, tp);
}

void ExecuteCancelCommand(const string respText)
{
   string ticketStr = ExtractJsonString(respText, "ticket");
   ulong ticket = (ulong)StringToInteger(ticketStr);
   if(ticket == 0) return;

   if(OrderSelect(ticket))
   {
      if(!ExtTrade.OrderDelete(ticket))
         Print("[trawangan MT5 Bridge] OrderDelete failed: ", ExtTrade.ResultRetcodeDescription());
      return;
   }
   if(PositionSelectByTicket(ticket))
   {
      if(!ExtTrade.PositionClose(ticket))
         Print("[trawangan MT5 Bridge] PositionClose failed: ", ExtTrade.ResultRetcodeDescription());
   }
}

void ExecuteManualOrder(string symbol, string side, string orderType, double volume, double price, double sl, double tp)
{
   if(!SymbolSelect(symbol, true))
   {
      Print("[trawangan MT5 Bridge] Symbol not found in MarketWatch: ", symbol);
      return;
   }

   bool ok = false;
   if(orderType == "MARKET")
   {
      if(side == "BUY")
         ok = ExtTrade.Buy(volume, symbol, 0.0, sl, tp, "trawangan manual");
      else
         ok = ExtTrade.Sell(volume, symbol, 0.0, sl, tp, "trawangan manual");
   }
   else if(orderType == "LIMIT")
   {
      if(side == "BUY")
         ok = ExtTrade.BuyLimit(volume, price, symbol, sl, tp, ORDER_TIME_GTC, 0, "trawangan manual");
      else
         ok = ExtTrade.SellLimit(volume, price, symbol, sl, tp, ORDER_TIME_GTC, 0, "trawangan manual");
   }

   if(ok)
      Print("[trawangan MT5 Bridge] Order executed successfully. Deal/Order=", ExtTrade.ResultOrder());
   else
      Print("[trawangan MT5 Bridge] Order failed: ", ExtTrade.ResultRetcodeDescription());
}

void OnTimer()
{
   // Sinkronisasi snapshot akun lokal & periksa antrean perintah manual dari trawangan
   char data[];
   char result[];
   string resultHeaders;
   string payload = BuildAccountSnapshotJson();
   StringToCharArray(payload, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(ArraySize(data) > 0) ArrayResize(data, ArraySize(data) - 1);

   string headers = "Content-Type: application/json\\r\\nX-Trawangan-Token: " + InpSecretToken + "\\r\\n";
   ResetLastError();
   int res = WebRequest("POST", InpBridgeUrl + "/mt5-sync", headers, 500, data, result, resultHeaders);
   if(res == 200 && ArraySize(result) > 2)
   {
      string respText = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      if(StringFind(respText, "\\"action\\":\\"ORDER\\"") >= 0)
         ExecuteManualOrderFromJson(respText);
      else if(StringFind(respText, "\\"action\\":\\"CANCEL\\"") >= 0)
         ExecuteCancelCommand(respText);
   }
}
//+------------------------------------------------------------------+
`;
}
