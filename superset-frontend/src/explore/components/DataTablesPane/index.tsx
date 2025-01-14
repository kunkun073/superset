/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { JsonObject, styled, t } from '@superset-ui/core';
import Collapse from 'src/components/Collapse';
import Tabs from 'src/components/Tabs';
import Loading from 'src/components/Loading';
import TableView, { EmptyWrapperType } from 'src/components/TableView';
import { getChartDataRequest } from 'src/chart/chartAction';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import {
  getFromLocalStorage,
  setInLocalStorage,
} from 'src/utils/localStorageHelpers';
import {
  CopyToClipboardButton,
  FilterInput,
  RowCount,
  useFilteredTableData,
  useTableColumns,
} from 'src/explore/components/DataTableControl';

const RESULT_TYPES = {
  results: 'results' as const,
  samples: 'samples' as const,
};

const NULLISH_RESULTS_STATE = {
  [RESULT_TYPES.results]: undefined,
  [RESULT_TYPES.samples]: undefined,
};

const DATA_TABLE_PAGE_SIZE = 50;

const STORAGE_KEYS = {
  isOpen: 'is_datapanel_open',
};

const DATAPANEL_KEY = 'data';

const TableControlsWrapper = styled.div`
  display: flex;
  align-items: center;

  span {
    flex-shrink: 0;
  }
`;

const SouthPane = styled.div`
  position: relative;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  z-index: 5;
  overflow: hidden;
`;

const TabsWrapper = styled.div<{ contentHeight: number }>`
  height: ${({ contentHeight }) => contentHeight}px;
  overflow: hidden;

  .table-condensed {
    height: 100%;
    overflow: auto;
  }
`;

const CollapseWrapper = styled.div`
  height: 100%;

  .collapse-inner {
    height: 100%;

    .ant-collapse-item {
      height: 100%;

      .ant-collapse-content {
        height: calc(100% - ${({ theme }) => theme.gridUnit * 8}px);

        .ant-collapse-content-box {
          padding-top: 0;
          height: 100%;
        }
      }
    }
  }
`;

const Error = styled.pre`
  margin-top: ${({ theme }) => `${theme.gridUnit * 4}px`};
`;

export const DataTablesPane = ({
  queryFormData,
  tableSectionHeight,
  onCollapseChange,
  chartStatus,
  ownState,
  errorMessage,
  queriesResponse,
}: {
  queryFormData: Record<string, any>;
  tableSectionHeight: number;
  chartStatus: string;
  ownState?: JsonObject;
  onCollapseChange: (openPanelName: string) => void;
  errorMessage?: JSX.Element;
  queriesResponse: Record<string, any>;
}) => {
  const [data, setData] = useState<{
    [RESULT_TYPES.results]?: Record<string, any>[];
    [RESULT_TYPES.samples]?: Record<string, any>[];
  }>(NULLISH_RESULTS_STATE);
  const [isLoading, setIsLoading] = useState({
    [RESULT_TYPES.results]: true,
    [RESULT_TYPES.samples]: true,
  });
  const [columnNames, setColumnNames] = useState<string[]>([]);
  const [error, setError] = useState(NULLISH_RESULTS_STATE);
  const [filterText, setFilterText] = useState('');
  const [activeTabKey, setActiveTabKey] = useState<string>(
    RESULT_TYPES.results,
  );
  const [isRequestPending, setIsRequestPending] = useState<{
    [RESULT_TYPES.results]?: boolean;
    [RESULT_TYPES.samples]?: boolean;
  }>(NULLISH_RESULTS_STATE);
  const [panelOpen, setPanelOpen] = useState(
    getFromLocalStorage(STORAGE_KEYS.isOpen, false),
  );

  const getData = useCallback(
    (resultType: string) => {
      setIsLoading(prevIsLoading => ({
        ...prevIsLoading,
        [resultType]: true,
      }));
      return getChartDataRequest({
        formData: queryFormData,
        resultFormat: 'json',
        resultType,
        ownState,
      })
        .then(({ json }) => {
          // Only displaying the first query is currently supported
          if (json.result.length > 1) {
            const data: any[] = [];
            json.result.forEach((item: { data: any[] }) => {
              item.data.forEach((row, i) => {
                if (data[i] !== undefined) {
                  data[i] = { ...data[i], ...row };
                } else {
                  data[i] = row;
                }
              });
            });
            setData(prevData => ({
              ...prevData,
              [resultType]: data,
            }));
          } else {
            setData(prevData => ({
              ...prevData,
              [resultType]: json.result[0].data,
            }));
          }

          setIsLoading(prevIsLoading => ({
            ...prevIsLoading,
            [resultType]: false,
          }));
          setError(prevError => ({
            ...prevError,
            [resultType]: null,
          }));
        })
        .catch(response => {
          getClientErrorObject(response).then(({ error, message }) => {
            setError(prevError => ({
              ...prevError,
              [resultType]: error || message || t('Sorry, An error occurred'),
            }));
            setIsLoading(prevIsLoading => ({
              ...prevIsLoading,
              [resultType]: false,
            }));
          });
        });
    },
    [queryFormData],
  );

  useEffect(() => {
    setInLocalStorage(STORAGE_KEYS.isOpen, panelOpen);
  }, [panelOpen]);

  useEffect(() => {
    setIsRequestPending(prevState => ({
      ...prevState,
      [RESULT_TYPES.results]: true,
    }));
  }, [queryFormData]);

  useEffect(() => {
    setIsRequestPending(prevState => ({
      ...prevState,
      [RESULT_TYPES.samples]: true,
    }));
  }, [queryFormData.adhoc_filters, queryFormData.datasource]);

  useEffect(() => {
    if (queriesResponse) {
      const { colnames } = queriesResponse[0];
      setColumnNames([...colnames]);
    }
  }, [queriesResponse]);

  useEffect(() => {
    if (panelOpen && isRequestPending[RESULT_TYPES.results]) {
      if (errorMessage) {
        setIsRequestPending(prevState => ({
          ...prevState,
          [RESULT_TYPES.results]: false,
        }));
        setIsLoading(prevIsLoading => ({
          ...prevIsLoading,
          [RESULT_TYPES.results]: false,
        }));
        return;
      }
      if (chartStatus === 'loading') {
        setIsLoading(prevIsLoading => ({
          ...prevIsLoading,
          [RESULT_TYPES.results]: true,
        }));
      } else {
        setIsRequestPending(prevState => ({
          ...prevState,
          [RESULT_TYPES.results]: false,
        }));
        getData(RESULT_TYPES.results);
      }
    }
    if (
      panelOpen &&
      isRequestPending[RESULT_TYPES.samples] &&
      activeTabKey === RESULT_TYPES.samples
    ) {
      setIsRequestPending(prevState => ({
        ...prevState,
        [RESULT_TYPES.samples]: false,
      }));
      getData(RESULT_TYPES.samples);
    }
  }, [
    panelOpen,
    isRequestPending,
    getData,
    activeTabKey,
    chartStatus,
    errorMessage,
  ]);

  const filteredData = {
    [RESULT_TYPES.results]: useFilteredTableData(
      filterText,
      data[RESULT_TYPES.results],
    ),
    [RESULT_TYPES.samples]: useFilteredTableData(
      filterText,
      data[RESULT_TYPES.samples],
    ),
  };

  // this is to preserve the order of the columns, even if there are integer values,
  // while also only grabbing the first column's keys
  const columns = {
    [RESULT_TYPES.results]: useTableColumns(
      columnNames,
      data[RESULT_TYPES.results],
    ),
    [RESULT_TYPES.samples]: useTableColumns(
      columnNames,
      data[RESULT_TYPES.samples],
    ),
  };

  const renderDataTable = (type: string) => {
    if (isLoading[type]) {
      return <Loading />;
    }
    if (error[type]) {
      return <Error>{error[type]}</Error>;
    }
    if (data[type]) {
      if (data[type]?.length === 0) {
        return <span>No data</span>;
      }
      return (
        <TableView
          columns={columns[type]}
          data={filteredData[type]}
          pageSize={DATA_TABLE_PAGE_SIZE}
          noDataText={t('No data')}
          emptyWrapperType={EmptyWrapperType.Small}
          className="table-condensed"
          isPaginationSticky
          showRowCount={false}
          small
        />
      );
    }
    if (errorMessage) {
      return <Error>{errorMessage}</Error>;
    }
    return null;
  };

  const TableControls = (
    <TableControlsWrapper>
      <RowCount data={data[activeTabKey]} loading={isLoading[activeTabKey]} />
      <CopyToClipboardButton data={data[activeTabKey]} columns={columnNames} />
      <FilterInput onChangeHandler={setFilterText} />
    </TableControlsWrapper>
  );

  const handleCollapseChange = (openPanelName: string) => {
    onCollapseChange(openPanelName);
    setPanelOpen(!!openPanelName);
  };

  return (
    <SouthPane data-test="some-purposeful-instance">
      <TabsWrapper contentHeight={tableSectionHeight}>
        <CollapseWrapper>
          <Collapse
            accordion
            bordered={false}
            defaultActiveKey={panelOpen ? DATAPANEL_KEY : undefined}
            onChange={handleCollapseChange}
            bold
            ghost
            className="collapse-inner"
          >
            <Collapse.Panel header={t('Data')} key={DATAPANEL_KEY}>
              <Tabs
                fullWidth={false}
                tabBarExtraContent={TableControls}
                activeKey={activeTabKey}
                onChange={setActiveTabKey}
              >
                <Tabs.TabPane
                  tab={t('View results')}
                  key={RESULT_TYPES.results}
                >
                  {renderDataTable(RESULT_TYPES.results)}
                </Tabs.TabPane>
                <Tabs.TabPane
                  tab={t('View samples')}
                  key={RESULT_TYPES.samples}
                >
                  {renderDataTable(RESULT_TYPES.samples)}
                </Tabs.TabPane>
              </Tabs>
            </Collapse.Panel>
          </Collapse>
        </CollapseWrapper>
      </TabsWrapper>
    </SouthPane>
  );
};
