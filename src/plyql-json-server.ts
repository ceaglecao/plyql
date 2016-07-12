/*
 * Copyright 2015-2016 Imply Data, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as Q from 'q';
import { Timezone } from "chronoshift";
import { Expression, Datum, PlywoodValue, Dataset } from "plywood";
import { createJSONServer, JSONParameters } from './json-server';
import { executeSQLParse, executePlywood } from "./plyql-executor";

export function plyqlJSONServer(port: number, context: Datum, timezone: Timezone): void {

  createJSONServer(port, (parameters: JSONParameters, res: any) => {
    var { sql, expression } = parameters;

    var resultPromise: Q.Promise<PlywoodValue>;

    if (expression) {
      try {
        var ex = Expression.fromJSLoose(expression);
      } catch (e) {
        res.status(400).send({ error: e.message });
        return;
      }

      resultPromise = executePlywood(ex, context, timezone);
    } else {
      try {
        var sqlParse = Expression.parseSQL(sql);
      } catch (e) {
        res.status(400).send({ error: e.message });
        return;
      }

      if (sqlParse.verb && sqlParse.verb !== 'SELECT') { // DESCRIBE + SHOW get re-written
        res.status(400).send({ error: `Unsupported SQL verb ${sqlParse.verb} must be SELECT, DESCRIBE, SHOW, or a raw expression` });
        return;
      }

      resultPromise = executeSQLParse(sqlParse, context, timezone);
    }

    resultPromise
      .then((value: PlywoodValue) => {
        if (Dataset.isDataset(value)) {
          res.json({
            result: value.toJS()
          });
        } else {
          res.json({
            result: value
          });
        }
      })
      .fail((e) => {
        res.status(500).send({ error: e.message });
      })
      .done();
  });

}
